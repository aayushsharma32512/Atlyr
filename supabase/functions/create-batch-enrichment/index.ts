// @ts-ignore
/* eslint-disable */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenAI } from "npm:@google/genai@^1.0.0"
import { corsHeaders, requireUser } from "../_shared/auth.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

// Same prompt as individual enrichment - kept in sync manually
const SYSTEM_INSTRUCTION = `You are an expert Fashion Director and AI Merchandiser. Your objective is to analyze an outfit image to generate structured metadata, specific UI tags, and a highly exhaustive search-optimized summary.

**1. APP UI CLASSIFICATION (Strict Selection)**
Select ONE value strictly from the provided dictionaries for 'ui_category' and 'ui_occasion'.
- **Category Options:** ['casual-outing', 'ceo-core', 'date-ready', 'old-money', 'streetwear', 'others']
- **Occasion Options:** ['brunch', 'business-casual', 'casual', 'date', 'party', 'travel', 'important-event', 'office-wear', 'default', 'others']

**2. COMPONENT INVENTORY (Zero-Miss Protocol)**
You must identify EVERY visible item. Do not group them broadly. Break them down:
- **Main Apparel:** Tops (Inner/Outer layers), Bottoms, Dresses, Outerwear.
- **Footwear:** Specific shoe type (e.g., 'Chelsea Boot' not just 'Boots').
- **Accessories:** Bags, Belts, Hats, Scarves, Sunglasses, Jewelry (Necklaces, Rings, Watches).
- *Note: If an item is partially visible, infer it based on context but label it clearly.*

**3. OUTFIT ANALYSIS**
- **Analyzed Occasions:** Array of 3 distinct strings (Primary + 2 Alternatives).
- **Visual Attributes:** Fit (2-3 tags), Feel (2-3 tags), Vibes (1-3 tags), Word Association (3-5 tags).
- **Marketing Name:** Catchy 3-5 word lookbook title.

**4. SEARCH SUMMARY (The 'Deep Semantic Stack')**
Construct a dense, exhaustive paragraph covering these 6 layers:
   A. **Full Inventory:** Explicitly name every identified component (e.g., '...styled with a gold chain necklace and leather belt...').
   B. **Color & Theme:** Palette and temperature.
   C. **Silhouette:** Architecture of the look.
   D. **Aesthetic Mapping:** Sub-cultures and vibes.
   E. **Suitability:** Weather, environment, user persona.
   F. **3 Styling Notes:** Specific styling techniques used.

**5. JSON OUTPUT FORMAT**
Return strictly valid JSON. Keys: 'outfit_name', 'ui_category', 'ui_occasion', 'analyzed_occasions', 'components_list' (array of strings), 'fit', 'feel', 'word_association', 'vibes', 'description_text', 'search_summary'.`

const ENRICHMENT_PROMPT = `Analyze the attached outfit image to generate the enrichment JSON.

**Task:**
1. **Inventory Scan:** Visually scan head-to-toe and populate the 'components_list' with EVERY distinct item (including jewelry, belts, bags).
2. **Classify:** Select strict UI tags.
3. **Analyze:** Generate marketing name, occasions, and visual attributes.
4. **Search Summary (Exhaustive):** Write a detailed paragraph. Ensure the Full Inventory is woven into the text naturally.
5. **Description:** Write a separate 4-sentence editorial description.
5. Output only the JSON object.`

/**
 * Detect MIME type from image URL extension
 * Falls back to 'image/png' if extension is unknown
 */
function getMimeTypeFromUrl(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase().split('?')[0] || ''
    const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'avif': 'image/avif',
        'svg': 'image/svg+xml',
        'json': 'application/json',
    }
    return mimeTypes[extension] || 'image/png'
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
    }

    try {
        // 1. Auth + admin check
        const ctx = await requireUser(req)
        if (!ctx.userId) {
            return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        const { data: profile } = await ctx.adminClient
            .from("profiles")
            .select("role")
            .eq("user_id", ctx.userId)
            .single()

        if (profile?.role !== "admin") {
            return new Response(JSON.stringify({ error: "FORBIDDEN", message: "Admin access required" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        const supabase = ctx.adminClient

        // 2. Check for existing pending/running batch jobs (prevent duplicate submissions)
        const { data: existingJob } = await supabase
            .from("batch_enrichment_jobs")
            .select("id, status")
            .in("status", ["pending", "running"])
            .limit(1)
            .maybeSingle()

        if (existingJob) {
            return new Response(JSON.stringify({
                error: "JOB_IN_PROGRESS",
                message: "A batch job is already in progress",
                jobId: existingJob.id
            }), {
                status: 409,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        // 3. Get unenriched outfits with images
        const { data: outfits, error: outfitsError } = await supabase
            .from("outfits")
            .select("id, outfit_images")
            .is("enriched_fit", null)
            .not("outfit_images", "is", null)
            .order("created_at", { ascending: false })
            .limit(100)

        if (outfitsError) {
            return new Response(JSON.stringify({ error: "DB_ERROR", message: outfitsError.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        // 4. Filter out outfits with pending drafts only
        // Rejected outfits CAN be re-enriched (user wants to try again)
        const { data: pendingDrafts } = await supabase
            .from("outfit_enrichment_drafts")
            .select("outfit_id")
            .eq("approval_status", "pending")

        const excludedIds = new Set(pendingDrafts?.map(d => d.outfit_id) ?? [])

        // #9 FIX: Filter outfits with invalid image URLs before batch creation
        // Also enforcing stricter URL validation to prevent SSRF/invalid inputs
        const eligibleOutfits = outfits?.filter(o => {
            if (excludedIds.has(o.id)) return false
            if (!o.outfit_images) return false

            try {
                const url = new URL(o.outfit_images)
                // Strict protocol check
                if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    console.warn(`Invalid protocol for outfit ${o.id}: ${url.protocol}`)
                    return false
                }
                // Basic localhost/internal IP check can be added here if needed, 
                // but checking protocol is a good first step.
                return true
            } catch (e) {
                console.warn(`Invalid URL format for outfit ${o.id}:`, o.outfit_images)
                return false
            }
        }) ?? []

        if (eligibleOutfits.length === 0) {
            return new Response(JSON.stringify({
                error: "NO_OUTFITS",
                message: "No outfits need enrichment"
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        // 5. Build batch requests with Supabase URLs directly
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

        const batchRequests = eligibleOutfits.map(outfit => ({
            customId: outfit.id, // CRITICAL: Use outfit ID for deterministic mapping
            contents: [{
                role: 'user',
                parts: [
                    { text: ENRICHMENT_PROMPT },
                    {
                        fileData: {
                            fileUri: outfit.outfit_images!,  // Direct Supabase URL
                            mimeType: getMimeTypeFromUrl(outfit.outfit_images!)
                        }
                    }
                ]
            }],
            config: {
                systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                responseMimeType: 'application/json',
                temperature: 0.5
            }
        }))

        // 6. Create batch job
        let batchJob
        try {
            batchJob = await ai.batches.create({
                model: 'gemini-3-pro-preview',
                src: batchRequests,
                config: { displayName: `enrichment-batch-${Date.now()}` }
            })
        } catch (geminiError) {
            const message = geminiError instanceof Error ? geminiError.message : "Gemini API error"
            console.error("Gemini batch creation failed:", geminiError)
            return new Response(JSON.stringify({ error: "GEMINI_API_ERROR", message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        // 7. Save job record
        const outfitIds = eligibleOutfits.map(o => o.id)
        const { data: jobRecord, error: insertError } = await supabase
            .from("batch_enrichment_jobs")
            .insert({
                gemini_batch_name: batchJob.name,
                status: 'pending',
                total_outfits: outfitIds.length,
                outfit_ids: outfitIds,
                created_by: ctx.userId
            })
            .select("id")
            .single()

        // #3 FIX: Cancel orphaned Gemini job if DB insert fails
        if (insertError) {
            try {
                await ai.batches.cancel({ name: batchJob.name })
                console.log(`Cancelled orphaned Gemini job: ${batchJob.name}`)
            } catch (cancelError) {
                console.error(`Failed to cancel orphaned Gemini job ${batchJob.name}:`, cancelError)
            }

            return new Response(JSON.stringify({ error: "INSERT_ERROR", message: insertError.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
        }

        return new Response(JSON.stringify({
            success: true,
            jobId: jobRecord.id,
            geminiBatchName: batchJob.name,
            totalOutfits: outfitIds.length
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        })

    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error("Batch enrichment error:", error)
        return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
    }
})
