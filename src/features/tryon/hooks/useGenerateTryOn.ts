import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { likenessKeys } from "@/features/likeness/queryKeys"
import { tryOnKeys } from "@/features/tryon/queryKeys"
import { generateTryOn, TryOnGeneratePayload, TryOnGenerateResponse } from "@/services/tryon/tryonService"
import { useJobs } from "@/features/progress/providers/JobsContext"

export function useGenerateTryOn(tempJobId?: string) {
  const queryClient = useQueryClient()
  const { updateJob } = useJobs()

  return useMutation({
    mutationKey: tryOnKeys.generate(),
    mutationFn: (payload: TryOnGeneratePayload) => generateTryOn(payload),
    onSuccess: (data: TryOnGenerateResponse) => {
      queryClient.invalidateQueries({ queryKey: tryOnKeys.list() })
      queryClient.invalidateQueries({ queryKey: tryOnKeys.generation(data.generationId) })
      queryClient.invalidateQueries({ queryKey: likenessKeys.list() })

      // Update temp job with real generation ID
      if (tempJobId) {
        updateJob(tempJobId, {
          id: data.generationId,
          metadata: { generationId: data.generationId },
          progress: 30, // Initial progress
        })
      }
    },
  })
}
