import { useQuery, type QueryClient } from "@tanstack/react-query"

import { studioKeys } from "@/features/studio/queryKeys"
import {
    studioService,
    type StudioAlternativeProduct,
    type StudioProductTraySlot,
} from "@/services/studio/studioService"
import type { ProductSearchFilters } from "@/services/search/searchService"

type Gender = "male" | "female" | null

interface UseStudioSearchResultsParams {
    slot: StudioProductTraySlot
    query: string
    imageUrl: string | null
    filters: ProductSearchFilters
    gender: Gender
    enabled?: boolean
    /** If true, search executes even without query text or image (returns all items) */
    allowEmptySearch?: boolean
}

function hashFilters(filters: ProductSearchFilters): string {
    try {
        return JSON.stringify(filters)
    } catch {
        return ""
    }
}

export function useStudioSearchResults({
    slot,
    query,
    imageUrl,
    filters,
    gender,
    enabled = true,
    allowEmptySearch = false,
}: UseStudioSearchResultsParams) {
    const filtersHash = hashFilters(filters)
    const trimmedQuery = query.trim()

    const queryKey = studioKeys.searchAlternatives({
        slot,
        query: trimmedQuery,
        imageUrl,
        filtersHash,
        gender,
    })

    // Enable query if we have either text or image search, OR if empty search is allowed
    const hasSearchParams = trimmedQuery.length > 0 || Boolean(imageUrl) || allowEmptySearch

    return useQuery<StudioAlternativeProduct[]>({
        queryKey,
        enabled: enabled && hasSearchParams,
        queryFn: async () => {
            console.log('[StudioSearchResults] Executing search:', {
                slot,
                query: trimmedQuery || '(none)',
                imageUrl: imageUrl || '(none)',
                filters,
                gender,
            })
            const results = await studioService.searchAlternatives({
                slot,
                query: trimmedQuery || undefined,
                imageUrl: imageUrl || undefined,
                filters,
                gender,
            })
            console.log('[StudioSearchResults] Got', results.length, 'results')
            return results
        },
        select: (data) => data ?? [],
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Export query options for prefetching if needed
export function getStudioSearchResultsQueryOptions({
    slot,
    query,
    imageUrl,
    filters,
    gender,
}: UseStudioSearchResultsParams) {
    const filtersHash = hashFilters(filters)
    const trimmedQuery = query.trim()

    return {
        queryKey: studioKeys.searchAlternatives({
            slot,
            query: trimmedQuery,
            imageUrl,
            filtersHash,
            gender,
        }),
        queryFn: () =>
            studioService.searchAlternatives({
                slot,
                query: trimmedQuery || undefined,
                imageUrl: imageUrl || undefined,
                filters,
                gender,
            }),
        staleTime: 30 * 1000,
    }
}

// Prefetch function for use in screens - side effects live in hooks layer
export function prefetchStudioSearchResults(
    queryClient: QueryClient,
    params: UseStudioSearchResultsParams
) {
    return queryClient.prefetchQuery(getStudioSearchResultsQueryOptions(params))
}
