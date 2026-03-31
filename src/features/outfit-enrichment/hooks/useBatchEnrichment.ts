import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { enrichmentQueryKeys } from "../queryKeys"
import {
    createBatchEnrichmentJob,
    pollBatchEnrichmentJob,
    type BatchJobStatus,
} from "@/services/outfit-enrichment/batchEnrichmentService"
import { useToast } from "@/hooks/use-toast"

type BatchJob = { id: string; status: string; total_outfits: number }

/**
 * Hook to manage batch enrichment operations.
 * 
 * Features:
 * - Checks for existing pending/running jobs on mount (resumes polling)
 * - Prevents duplicate job creation via backend check
 * - Polls every 30 seconds until completion
 */
export function useBatchEnrichment() {
    const [jobId, setJobId] = useState<string | null>(null)
    const queryClient = useQueryClient()
    const { toast } = useToast()

    // Check for existing pending/running job on mount
    const { data: existingJob, isLoading: isCheckingExisting } = useQuery<BatchJob | null>({
        queryKey: enrichmentQueryKeys.batchJobs(),
        queryFn: async (): Promise<BatchJob | null> => {
            const { data, error } = await supabase
                .from("batch_enrichment_jobs")
                .select("id, status, total_outfits")
                .in("status", ["pending", "running"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()
            if (error) return null
            return data as BatchJob | null
        },
        staleTime: 5_000, // Cache for 5 seconds
    })

    // Resume polling if existing job found
    useEffect(() => {
        if (existingJob && !jobId) {
            setJobId(existingJob.id)
        }
    }, [existingJob, jobId])

    // Start batch mutation
    const startMutation = useMutation({
        mutationFn: () => createBatchEnrichmentJob(supabase),
        onSuccess: (data) => {
            setJobId(data.jobId)
            // Invalidate existing job query
            queryClient.invalidateQueries({ queryKey: enrichmentQueryKeys.batchJobs() })
            if (data.totalOutfits > 0) {
                toast({
                    title: "Batch enrichment started",
                    description: `Processing ${data.totalOutfits} outfits...`,
                })
            } else {
                // Resuming existing job
                toast({
                    title: "Resuming batch enrichment",
                    description: "Found existing job in progress...",
                })
            }
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to start batch",
                description: error.message,
                variant: "destructive",
            })
        },
    })

    // Poll for status using query key factory
    const { data: jobStatus } = useQuery<BatchJobStatus>({
        queryKey: enrichmentQueryKeys.batchJob(jobId ?? ""),
        queryFn: () => pollBatchEnrichmentJob(supabase, jobId!),
        enabled: !!jobId,
        refetchInterval: (query) => {
            const status = query.state.data?.status
            if (status === "succeeded" || status === "failed" || status === "cancelled") {
                return false // Stop polling
            }
            return 30_000 // Poll every 30 seconds
        },
    })

    // Handle completion
    useEffect(() => {
        if (jobStatus?.status === "succeeded") {
            toast({
                title: "Batch enrichment complete!",
                description: `Successfully enriched ${jobStatus.processedOutfits} outfits${jobStatus.failedOutfits ? ` (${jobStatus.failedOutfits} failed)` : ""
                    }`,
            })
            queryClient.invalidateQueries({ queryKey: enrichmentQueryKeys.all })
            setJobId(null)
        }

        if (jobStatus?.status === "failed" || jobStatus?.status === "cancelled") {
            toast({
                title: "Batch enrichment failed",
                description: jobStatus.error || "Unknown error",
                variant: "destructive",
            })
            setJobId(null)
        }
    }, [jobStatus?.status, jobStatus?.processedOutfits, jobStatus?.failedOutfits, jobStatus?.error, toast, queryClient])

    // Job is running if we have an active jobId and status is pending/running,
    // OR if we found an existing job that hasn't been loaded into jobId yet
    const isRunning =
        (jobStatus?.status === "pending" || jobStatus?.status === "running") ||
        (existingJob && existingJob.status !== "succeeded" && existingJob.status !== "failed")

    return {
        startBatch: startMutation.mutate,
        isStarting: startMutation.isPending,
        isCheckingExisting,
        jobStatus,
        isRunning,
        existingJobId: existingJob?.id,
    }
}
