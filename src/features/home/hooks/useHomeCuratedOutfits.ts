import { useQuery } from "@tanstack/react-query"

import { homeKeys } from "@/features/home/queryKeys"
import { useProfileContext } from "@/features/profile/providers/ProfileProvider"
import { homeService, type HomeOutfitEntry } from "@/services/home/homeService"

export function useHomeCuratedOutfits(limit = 24) {
  const { gender, isLoading: isProfileLoading } = useProfileContext()

  return useQuery({
    queryKey: homeKeys.curatedOutfits(gender ?? null),
    enabled: !isProfileLoading,
    queryFn: () =>
      homeService.getCuratedOutfits({
        gender: gender ?? null,
        limit,
      }) as Promise<HomeOutfitEntry[]>,
    staleTime: 2 * 60 * 1000,
  })
}


