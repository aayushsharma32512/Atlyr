import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/integrations/supabase/types"

export interface BatchJobStatus {
    status: "pending" | "running" | "succeeded" | "failed" | "cancelled"
    totalOutfits: number
    processedOutfits: number
    failedOutfits?: number
    error?: string
}

export interface CreateBatchResponse {
    success: boolean
    jobId: string
    totalOutfits: number
    error?: string
}

/**
 * Create a batch enrichment job for all unenriched outfits.
 * 
 * This triggers the create-batch-enrichment edge function which:
 * 1. Checks for existing pending/running jobs (prevents duplicates)
 * 2. Queries all outfits without enrichment data
 * 3. Filters out outfits with pending/rejected drafts
 * 4. Creates a Gemini batch job
 * 5. Stores the job record for polling
 * 
 * Returns existing jobId if a job is already in progress.
 */
export async function createBatchEnrichmentJob(
    supabase: SupabaseClient<Database>
): Promise<CreateBatchResponse> {
    const { data, error } = await supabase.functions.invoke<CreateBatchResponse & { error?: string; jobId?: string }>(
        "create-batch-enrichment"
    )

    if (error) {
        throw new Error(`Failed to create batch job: ${error.message}`)
    }

    // Handle job already in progress - return existing job ID
    if (data?.error === "JOB_IN_PROGRESS" && data?.jobId) {
        return {
            success: true,
            jobId: data.jobId,
            totalOutfits: 0, // Unknown for existing job
        }
    }

    if (!data?.success) {
        throw new Error(data?.error || "Failed to create batch job")
    }

    return data
}

/**
 * Poll the status of a batch enrichment job.
 * 
 * This triggers the poll-batch-enrichment edge function which:
 * 1. Checks the Gemini batch job status
 * 2. If succeeded, parses results and creates enrichment drafts
 * 3. Updates the job record in the database
 */
export async function pollBatchEnrichmentJob(
    supabase: SupabaseClient<Database>,
    jobId: string
): Promise<BatchJobStatus> {
    const { data, error } = await supabase.functions.invoke<BatchJobStatus>(
        "poll-batch-enrichment",
        { body: { jobId } }
    )

    if (error) {
        throw new Error(`Failed to poll batch job: ${error.message}`)
    }

    if (!data) {
        throw new Error("No response from poll endpoint")
    }

    return data
}
