import { createClient } from '@supabase/supabase-js';
import {
  AutoTokenizer,
  AutoProcessor,
  SiglipTextModel,
  SiglipVisionModel,
  RawImage,
} from '@huggingface/transformers';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Initialize Supabase client with service_role key for updates
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials.');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!supabaseKey.startsWith('sb_secret_')) {
  console.error('❌ ERROR: Must use service_role key (starts with sb_secret_)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Model configuration
const MODEL_NAME = 'Marqo/marqo-fashionSigLIP';
let tokenizer = null;
let textModel = null;
let processor = null;
let visionModel = null;

/**
 * Initialize models (download and cache them locally)
 */
export async function initializeModels() {
  console.log('📥 Loading models from HuggingFace Hub (this may take a few minutes on first run)...\n');
  
  try {
    console.log('  🔤 Loading tokenizer...');
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_NAME);
    console.log('  ✅ Tokenizer loaded');
    
    console.log('  📝 Loading text model...');
    textModel = await SiglipTextModel.from_pretrained(MODEL_NAME);
    console.log('  ✅ Text model loaded');
    
    console.log('  🖼️  Loading image processor...');
    processor = await AutoProcessor.from_pretrained(MODEL_NAME);
    console.log('  ✅ Image processor loaded');
    
    console.log('  🎨 Loading vision model...');
    visionModel = await SiglipVisionModel.from_pretrained(MODEL_NAME);
    console.log('  ✅ Vision model loaded\n');
    
    console.log('✅ All models loaded successfully!\n');
  } catch (error) {
    console.error('❌ Error loading models:', error.message);
    throw error;
  }
}

/**
 * Build concatenated text from product fields
 */
export function buildProductText(product) {
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

/**
 * Generate text embedding using Fashion-SigLIP locally
 */
export async function generateTextEmbedding(text) {
  try {
    // Tokenize the text using batch()
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

/**
 * Generate image embedding using Fashion-SigLIP locally
 */
export async function generateImageEmbedding(imageUrl) {
  try {
    // Fetch image manually for reliable remote URL handling
    const res = await fetch(imageUrl);
    const arrayBuffer = await res.arrayBuffer();
    const blob = new Blob([arrayBuffer]);         // Node supports Blob globally
    const image = await RawImage.fromBlob(blob);
    
    const inputs = await processor(image);
    
    // Generate embeddings
    const output = await visionModel(inputs);
    
    // Extract image embeddings, normalize, and convert to array
    const imageEmbeds = output.image_embeds.normalize().tolist()[0];
    
    return imageEmbeds;
  } catch (error) {
    console.error(`Error generating image embedding for ${imageUrl}:`, error.message);
    throw error;
  }
}

/**
 * Update product with embeddings in Supabase
 */
async function updateProductEmbeddings(productId, textVector, imageVector) {
  const updates = {};
  
  if (textVector) {
    updates.text_vector = textVector;
  }
  
  if (imageVector) {
    updates.image_vector = imageVector;
  }
  
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .select();
  
  if (error) {
    throw new Error(`Failed to update product ${productId}: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    throw new Error(`Product ${productId} not found in database`);
  }
}

/**
 * Process a single product
 */
async function processProduct(product, productNum, totalProducts) {
  const { id, image_url, text_vector, image_vector } = product;
  
  console.log(`\n[${productNum}/${totalProducts}] Processing product: ${id}`);
  
  let newTextVector = null;
  let newImageVector = null;
  let textSuccess = false;
  let imageSuccess = false;
  
  // Always generate text embedding (regenerate even if exists)
  try {
    const productText = buildProductText(product);
    if (productText) {
      console.log(`  📝 ${text_vector ? 'Regenerating' : 'Generating'} text embedding...`);
      newTextVector = await generateTextEmbedding(productText);
      console.log(`  ✅ Text embedding generated (${newTextVector.length} dimensions)`);
      textSuccess = true;
    } else {
      console.log(`  ⚠️  No text content available, skipping text embedding`);
      textSuccess = true; // Consider as success if no data to process
    }
  } catch (error) {
    console.error(`  ❌ Failed to generate text embedding:`, error.message);
  }
  
  // Always generate image embedding (regenerate even if exists)
  try {
    if (image_url) {
      console.log(`  🖼️  ${image_vector ? 'Regenerating' : 'Generating'} image embedding...`);
      newImageVector = await generateImageEmbedding(image_url);
      console.log(`  ✅ Image embedding generated (${newImageVector.length} dimensions)`);
      imageSuccess = true;
    } else {
      console.log(`  ⚠️  No image URL available, skipping image embedding`);
      imageSuccess = true; // Consider as success if no data to process
    }
  } catch (error) {
    console.error(`  ❌ Failed to generate image embedding:`, error.message);
  }
  
  // Update database with new embeddings
  if (newTextVector || newImageVector) {
    try {
      console.log(`  💾 Updating database...`);
      await updateProductEmbeddings(id, newTextVector, newImageVector);
      console.log(`  ✅ Database updated successfully`);
    } catch (error) {
      console.error(`  ❌ Failed to update database:`, error.message);
      return false;
    }
  }
  
  return textSuccess && imageSuccess;
}

/**
 * Process products in batches
 */
async function processBatch(products, batchNum, totalBatches) {
  console.log('\n' + '='.repeat(70));
  console.log(`🔄 BATCH ${batchNum}/${totalBatches} (${products.length} products)`);
  console.log('='.repeat(70));
  
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const globalProductNum = (batchNum - 1) * 20 + i + 1;
    const totalProducts = (batchNum - 1) * 20 + products.length;
    
    const success = await processProduct(product, globalProductNum, totalProducts);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '-'.repeat(70));
  console.log(`✅ Batch ${batchNum} complete in ${elapsedTime}s`);
  console.log(`   Success: ${successCount} | Failed: ${failCount}`);
  console.log('-'.repeat(70));
  
  return { successCount, failCount };
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 Fashion-SigLIP Local Embedding Generation');
  console.log('='.repeat(70));
  console.log(`📊 Model: ${MODEL_NAME}`);
  console.log(`🔗 Supabase URL: ${supabaseUrl}`);
  console.log(`💻 Mode: Local (no API calls)`);
  console.log('='.repeat(70) + '\n');
  
  // Initialize models
  await initializeModels();
  
  // Fetch ALL products (regenerate embeddings for all)
  console.log('📥 Fetching all products from database...\n');
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, product_name, description, fit, feel, color, vibes, type_category, image_url, text_vector, image_vector');
  
  if (error) {
    console.error('❌ Error fetching products:', error);
    process.exit(1);
  }
  
  if (!products || products.length === 0) {
    console.log('✅ No products found in database.');
    process.exit(0);
  }
  
  console.log(`📦 Found ${products.length} products (will regenerate ALL embeddings)\n`);
  
  // Count how many already have embeddings vs new
  const existingTextCount = products.filter(p => p.text_vector).length;
  const existingImageCount = products.filter(p => p.image_vector).length;
  console.log(`   📝 Existing text embeddings: ${existingTextCount} (will regenerate)`);
  console.log(`   🖼️  Existing image embeddings: ${existingImageCount} (will regenerate)\n`);
  
  // Process in batches of 20 (smaller batches for local processing)
  const BATCH_SIZE = 20;
  const batches = [];
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    batches.push(products.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`📊 Processing ${batches.length} batches of up to ${BATCH_SIZE} products each\n`);
  
  let totalSuccess = 0;
  let totalFail = 0;
  const overallStartTime = Date.now();
  
  for (let i = 0; i < batches.length; i++) {
    const { successCount, failCount } = await processBatch(batches[i], i + 1, batches.length);
    totalSuccess += successCount;
    totalFail += failCount;
    
    // Small delay between batches to let memory settle
    if (i < batches.length - 1) {
      console.log('\n⏳ Pausing 3 seconds before next batch...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  const totalElapsedTime = ((Date.now() - overallStartTime) / 1000).toFixed(2);
  const avgTimePerProduct = (totalElapsedTime / (totalSuccess + totalFail)).toFixed(2);
  
  console.log('\n' + '='.repeat(70));
  console.log('🎉 EMBEDDING GENERATION COMPLETE!');
  console.log('='.repeat(70));
  console.log(`📊 Total Products: ${totalSuccess + totalFail}`);
  console.log(`✅ Successful: ${totalSuccess}`);
  console.log(`❌ Failed: ${totalFail}`);
  console.log(`⏱️  Total Time: ${totalElapsedTime}s`);
  console.log(`⏱️  Avg Time per Product: ${avgTimePerProduct}s`);
  console.log('='.repeat(70) + '\n');
}

// Run the script
main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
