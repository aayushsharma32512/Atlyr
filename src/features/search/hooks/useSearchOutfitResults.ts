import { useInfiniteQuery } from "@tanstack/react-query"

import { useProfileContext } from "@/features/profile/providers/ProfileProvider"
import { searchKeys } from "@/features/search/queryKeys"
import {
  type OutfitSearchFilters,
  type OutfitSearchResult,
  searchService,
} from "@/services/search/searchService"

interface UseSearchOutfitResultsParams {
  query: string
  filters?: OutfitSearchFilters
  enabled: boolean
}

export function useSearchOutfitResults({ query, filters, enabled }: UseSearchOutfitResultsParams) {
  const { gender } = useProfileContext()
  const trimmed = query.trim()

  return useInfiniteQuery({
    queryKey: searchKeys.outfitResults({ query: trimmed, gender, filters }),
    queryFn: ({ pageParam }) =>
      searchService.searchOutfits({
        query: trimmed,
        gender,
        cursor: typeof pageParam === "number" ? pageParam : 0,
        filters,
      }),
    enabled: enabled && trimmed.length > 0,
    refetchOnWindowFocus: false,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (data) => {
      const pages = data.pages.map((page) => ({
        nextCursor: page.nextCursor,
        results: page.results.filter((result): result is OutfitSearchResult => Boolean(result)),
      }))
      return { ...data, pages }
    },
  })
}


