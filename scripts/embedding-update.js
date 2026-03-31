/**
 * Fashion Product Embedding Update Script (Unified)
 * 
 * This script generates and updates text/image vector embeddings for products.
 * Supports two modes:
 * 
 * 1. QUEUE MODE (default, fast):
 *    - Processes only items in embedding_queue table
 *    - Triggered automatically every 15 minutes by pg_cron
 *    - Near-real-time updates for product changes
 * 
 * 2. FULL-SCAN MODE (--full-scan flag, comprehensive):
 *    - Scans all products for missing embeddings
 *    - Safety net to catch any missed items
 *    - Run daily at 2 AM via GitHub Actions
 * 
 * Usage:
 *   bun run scripts/embedding-update.js                  # Queue mode
 *   bun run scripts/embedding-update.js --full-scan      # Full scan mode
 */

import { createClient } from '@supabase/supabase-js';
import {
  AutoTokenizer,
  AutoProcessor,
  SiglipTextModel,
  SiglipVisionModel,
  RawImage,
} from '@huggingface/transformers';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const FULL_SCAN_MODE = process.argv.includes('--full-scan');
const CURRENT_VECTOR_VERSION = 1;
const MODEL_NAME = 'Marqo/marqo-fashionSigLIP';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let tokenizer, textModel, processor, visionModel;

// Initialize Fashion-SigLIP models
async function initializeModels() {
  console.log('🔧 Loading Fashion-SigLIP models...');
  const startTime = Date.now();
  
  try {
    console.log('  🔤 Loading tokenizer...');
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_NAME);
    
    console.log('  📝 Loading text model...');
    textModel = await SiglipTextModel.from_pretrained(MODEL_NAME);
    
    console.log('  🖼️  Loading image processor...');
    processor = await AutoProcessor.from_pretrained(MODEL_NAME);
    
    console.log('  🎨 Loading vision model...');
    visionModel = await SiglipVisionModel.from_pretrained(MODEL_NAME);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ All models loaded (${duration}s)\n`);
  } catch (error) {
    console.error('❌ Error loading models:', error.message);
    throw error;
  }
}

// Fetch products from embedding queue
async function fetchProductsFromQueue() {
  console.log('📥 Fetching products from embedding queue...');
  
  const { data, error } = await supabase
    .from('embedding_queue')
    .select(`
      id,
      product_id,
      needs_text_embedding,
      needs_image_embedding,
      products (
        id,
        product_name,
        description,
        type,
        type_category,
        fit,
        feel,
        vibes,
        color,
        image_url,
        text_vector,
        image_vector
      )
    `)
    .order('queued_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('❌ Error fetching queue:', error);
    return [];
  }

  // Flatten the result to products with queue metadata
  const products = (data || [])
    .filter(item => item.products)
    .map(item => ({
      ...item.products,
      queue_id: item.id,
      needs_text_embedding: item.needs_text_embedding,
      needs_image_embedding: item.needs_image_embedding,
      from_queue: true
    }));

  console.log(`Found ${products.length} products in queue`);
  return products;
}

// Fetch all products needing embeddings (full scan)
async function fetchProductsNeedingUpdate() {
  console.log('📥 Fetching all products needing embeddings...');
  
  const { data, error } = await supabase
    .from('products')
    .select('id, product_name, description, type, type_category, fit, feel, vibes, color, image_url, text_vector, image_vector')
    .or('text_vector.is.null,image_vector.is.null');

  if (error) {
    console.error('❌ Error fetching products:', error);
    return [];
  }

  const products = (data || []).map(p => ({
    ...p,
    from_queue: false
  }));

  console.log(`Found ${products.length} products needing updates`);
  return products;
}

// Build concatenated text from product fields
function buildProductText(product) {
  const fields = [
    product.product_name,
    product.description,
    product.fit,
    product.feel,
    product.color,
    product.vibes,
    product.type_category
  ];
  
  return fields
    .filter(field => field != null && field !== '')
    .join('. ')
    .trim();
}

// Generate text embedding using Fashion-SigLIP
async function generateTextEmbedding(product) {
  try {
    const text = buildProductText(product);
    if (!text) return null;
    
    // Tokenize the text
    const inputs = await tokenizer([text], { 
      padding: 'max_length', 
      truncation: true 
    });
    
    // Generate embeddings
    const output = await textModel(inputs);
    
    // Extract text embeddings, normalize, and convert to array
    const textEmbeds = output.text_embeds.normalize().tolist()[0];
    
    return textEmbeds;
  } catch (error) {
    console.error('Error generating text embedding:', error.message);
    throw error;
  }
}

// Generate image embedding using Fashion-SigLIP
async function generateImageEmbedding(imageUrl) {
  if (!imageUrl) return null;
  
  try {
    // Fetch image manually for reliable remote URL handling
    const res = await fetch(imageUrl);
    const arrayBuffer = await res.arrayBuffer();
    const blob = new Blob([arrayBuffer]);
    const image = await RawImage.fromBlob(blob);
    
    const inputs = await processor(image);
    
    // Generate embeddings
    const output = await visionModel(inputs);
    
    // Extract image embeddings, normalize, and convert to array
    const imageEmbeds = output.image_embeds.normalize().tolist()[0];
    
    return imageEmbeds;
  } catch (err) {
    console.error(`  ⚠️  Image embedding failed: ${err.message}`);
    return null;
  }
}

// Update product embeddings in database
async function updateProductEmbeddings(productId, updates, removeFromQueue = false, queueId = null) {
  // Add versioning metadata
  updates.embedded_at = new Date().toISOString();
  updates.vector_version = CURRENT_VECTOR_VERSION;

  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId);

  if (error) {
    console.error(`  ❌ Database update failed: ${error.message}`);
    return false;
  }

  // Remove from queue if this was a queue item
  if (removeFromQueue && queueId) {
    await supabase
      .from('embedding_queue')
      .delete()
      .eq('id', queueId);
  }

  // In full-scan mode, also cleanup any orphaned queue entries for this product
  if (!removeFromQueue && FULL_SCAN_MODE) {
    await supabase
      .from('embedding_queue')
      .delete()
      .eq('product_id', productId);
  }

  return true;
}

// Process a single product
async function processProduct(product, index, total) {
  const { id, product_name, image_url, text_vector, image_vector, from_queue, needs_text_embedding, needs_image_embedding, queue_id } = product;
  
  console.log(`\n[${index + 1}/${total}] Processing: ${id}`);
  console.log(`  Name: ${product_name}`);

  // Determine what needs processing
  const shouldProcessText = from_queue ? needs_text_embedding && !text_vector : !text_vector;
  const shouldProcessImage = from_queue ? needs_image_embedding && !image_vector : !image_vector;

  if (!shouldProcessText && !shouldProcessImage) {
    console.log('  ✅ All embeddings already exist');
    if (from_queue && queue_id) {
      await supabase.from('embedding_queue').delete().eq('id', queue_id);
    }
    return { success: true, text: false, image: false };
  }

  const updates = {};
  let generatedText = false;
  let generatedImage = false;

  // Generate text embedding
  if (shouldProcessText) {
    try {
      const textEmbedding = await generateTextEmbedding(product);
      updates.text_vector = textEmbedding;
      generatedText = true;
      console.log('  ✅ Text embedding generated');
    } catch (err) {
      console.error(`  ❌ Text embedding failed: ${err.message}`);
    }
  } else {
    console.log('  ⏭️  Text embedding exists');
  }

  // Generate image embedding
  if (shouldProcessImage) {
    if (!image_url) {
      console.log('  ⚠️  No image URL');
    } else {
      const imageEmbedding = await generateImageEmbedding(image_url);
      if (imageEmbedding) {
        updates.image_vector = imageEmbedding;
        generatedImage = true;
        console.log('  ✅ Image embedding generated');
      }
    }
  } else {
    console.log('  ⏭️  Image embedding exists');
  }

  // Update database
  if (Object.keys(updates).length > 0) {
    const success = await updateProductEmbeddings(id, updates, from_queue, queue_id);
    if (success) {
      console.log('  💾 Database updated');
    }
    return { success, text: generatedText, image: generatedImage };
  }

  return { success: true, text: false, image: false };
}

// Main execution
async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Fashion Product Embedding Update Tool   ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const mode = FULL_SCAN_MODE ? 'FULL-SCAN' : 'QUEUE';
  console.log(`🔍 Mode: ${mode}`);
  console.log(`⏰ Started: ${new Date().toLocaleString()}\n`);

  const startTime = Date.now();

  try {
    // Initialize models
    await initializeModels();

    // Fetch products based on mode
    const products = FULL_SCAN_MODE
      ? await fetchProductsNeedingUpdate()
      : await fetchProductsFromQueue();

    if (products.length === 0) {
      console.log('✨ No products to process');
      return;
    }

    // Process all products
    console.log(`\n📊 Processing ${products.length} products...\n`);
    console.log('─'.repeat(50));

    const results = {
      total: products.length,
      successful: 0,
      failed: 0,
      textGenerated: 0,
      imageGenerated: 0
    };

    for (let i = 0; i < products.length; i++) {
      const result = await processProduct(products[i], i, products.length);
      
      if (result.success) {
        results.successful++;
        if (result.text) results.textGenerated++;
        if (result.image) results.imageGenerated++;
      } else {
        results.failed++;
      }
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n' + '─'.repeat(50));
    console.log('\n📋 Summary:');
    console.log(`  Mode: ${mode}`);
    console.log(`  Total Products: ${results.total}`);
    console.log(`  ✅ Successful: ${results.successful}`);
    console.log(`  ❌ Failed: ${results.failed}`);
    console.log(`  📝 Text Embeddings: ${results.textGenerated}`);
    console.log(`  🖼️  Image Embeddings: ${results.imageGenerated}`);
    console.log(`  ⏱️  Duration: ${duration}s`);
    console.log(`  ⏰ Finished: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
