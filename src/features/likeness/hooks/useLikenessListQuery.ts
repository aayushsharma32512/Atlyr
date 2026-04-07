import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/contexts/AuthContext"
import { likenessKeys } from "@/features/likeness/queryKeys"
import { listLikeness, type LikenessPose } from "@/services/likeness/likenessService"

interface UseLikenessListQueryParams {
  enabled?: boolean
}

export function useLikenessListQuery({ enabled = true }: UseLikenessListQueryParams = {}) {
  const { user } = useAuth()

  return useQuery<LikenessPose[]>({
    queryKey: likenessKeys.list(),
    queryFn: () => listLikeness(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(user?.id),
  })
}


