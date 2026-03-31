import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"

import { Button } from "@/components/ui/button"
import {
  FilterSearchBar,
  type FilterSearchBarChip,
  OutfitInspirationGrid,
  ProductResultsGrid,
  RecentStylesRail,
  SectionHeader,
  MoodboardPickerDrawer,
  type FilterCategory,
} from "@/design-system/primitives"
import { AppShellLayout } from "@/layouts/AppShellLayout"
import { MoodboardPins, type MoodboardTab } from "./components/MoodboardPins"
import { cn } from "@/lib/utils"
import { useProfileContext } from "@/features/profile/providers/ProfileProvider"
import { useAuth } from "@/contexts/AuthContext"
import { useHomeRecentStyles } from "@/features/home/hooks/useHomeRecentStyles"
import { useHomeCuratedOutfits } from "@/features/home/hooks/useHomeCuratedOutfits"
import { useSearchOutfitResults } from "@/features/search/hooks/useSearchOutfitResults"
import { useSearchProductResults } from "@/features/search/hooks/useSearchProductResults"
import type { OutfitSearchFilters, ProductSearchFilters } from "@/services/search/searchService"
import { useLaunchStudio } from "@/features/studio/hooks/useLaunchStudio"
import type { InspirationItem } from "@/features/studio/types"
import { mapLegacyOutfitItemsToStudioItems } from "@/features/studio/mappers/renderedItemMapper"
import type { HomeOutfitEntry } from "@/services/home/homeService"
import type { Outfit } from "@/types"
import { useScrollRestoration } from "@/shared/hooks/useScrollRestoration"
import {
  useTryOns,
  useFavorites,
  useSaveToCollection,
  useRemoveOutfitFromLibrary,
  useCreateMoodboard,
  useMoodboardItems,
  useCollectionsOverview,
} from "@/features/collections/hooks/useMoodboards"
import { useProductSaveActions } from "@/features/collections/hooks/useProductSaveActions"
import { collectionsKeys } from "@/features/collections/queryKeys"
import { TryOnGrid } from "@/features/home/components/TryOnGrid"
import { TryOnPreviewOverlay } from "@/features/home/components/TryOnPreviewOverlay"
import type { TryOn } from "@/services/collections/collectionsService"
import { fetchMoodboardItems, fetchMoodboardItemsBatch } from "@/services/collections/collectionsService"
import { buildStudioUrl } from "@/features/studio/utils/studioUrlState"
import { useToast } from "@/hooks/use-toast"
import { MixedMasonryGrid } from "@/features/collections/components/MixedMasonryGrid"
import { resolveOutfitAttribution } from "@/utils/outfitAttribution"
import { getOutfitChips } from "@/utils/outfitChips"

const CARD_MAX_WIDTH = "24.5rem"

export function HomeScreenView() {
  useScrollRestoration("scroll:home")
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const searchParamValue = searchParams.get("search") ?? ""
  const modeParamValue = searchParams.get("mode") === "products" ? "products" : "outfits"
  const moodboardParam = searchParams.get("moodboard")

  // Derive state from URL params to prevent flash during navigation
  const committedSearchTerm = searchParamValue
  const isResultsMode = searchParamValue.trim().length > 0

  const [searchTerm, setSearchTerm] = useState(searchParamValue)
  const [activeFilter, setActiveFilter] = useState<"products" | "outfits">(
    searchParamValue.trim().length > 0 ? modeParamValue : "outfits",
  )
  const [activeMoodboardId, setActiveMoodboardId] = useState(
    () => sessionStorage.getItem("home:activeMoodboard") ?? "for-you"
  )
  const [outfitFilters] = useState<OutfitSearchFilters>({})
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const lastScrollTopRef = useRef(0)
  const [isTopBarVisible, setIsTopBarVisible] = useState(true)
  const lastUserIdRef = useRef<string | null>(null)
  const { gender: profileGender, heightCm } = useProfileContext()
  const [selectedTryOnIndex, setSelectedTryOnIndex] = useState<number | null>(null)
  const lastMoodboardPrefetchKeyRef = useRef<string | null>(null)
  const [isMoodboardPickerOpen, setIsMoodboardPickerOpen] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [pendingOutfitId, setPendingOutfitId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | undefined>(undefined)

  const { toast } = useToast()
  const queryClient = useQueryClient()
  const productSaveActions = useProductSaveActions()
  const { user } = useAuth()

  const buildInspirationFromEntry = useCallback(
    (entry: HomeOutfitEntry): InspirationItem => ({
      id: entry.id,
      variant: "narrow" as const,
      title: entry.title,
      chips: entry.chips,
      attribution: resolveOutfitAttribution(entry.outfit.created_by),
      outfitId: entry.outfit.id,
      renderedItems: entry.renderedItems ?? mapLegacyOutfitItemsToStudioItems(entry.outfit.items),
      gender: profileGender ?? "female",
      heightCm: heightCm ?? 170,
      showTitle: true,
      showChips: true,
      showSaveButton: false,
      outfit: entry.outfit,
    }),
    [heightCm, profileGender],
  )

  const outfitResultsQuery = useSearchOutfitResults({
    query: committedSearchTerm,
    filters: outfitFilters,
    enabled: isResultsMode && activeFilter === "outfits",
  })

  const [isSearchSubmitting, setIsSearchSubmitting] = useState(false)

  const productResultsQuery = useSearchProductResults({
    query: committedSearchTerm,
    enabled: isResultsMode && activeFilter === "products" && !isSearchSubmitting,
  })

  const recentStylesQuery = useHomeRecentStyles(10)
  const curatedOutfitsQuery = useHomeCuratedOutfits()
  const TRY_ON_PAGE_SIZE = 20
  const MOODBOARD_PAGE_SIZE = 20
  const tryOnsQuery = useTryOns(TRY_ON_PAGE_SIZE)
  const favoritesQuery = useFavorites()
  const favoriteIds = favoritesQuery.data ?? []
  const saveToCollectionMutation = useSaveToCollection()
  const removeOutfitFromLibraryMutation = useRemoveOutfitFromLibrary()
  const createMoodboardMutation = useCreateMoodboard()

  const recentStyles = recentStylesQuery.data ?? []
  const curatedOutfits = curatedOutfitsQuery.data ?? []
  const isRecentLoading = recentStylesQuery.isLoading
  const isRecentError = recentStylesQuery.isError
  const isCuratedLoading = curatedOutfitsQuery.isLoading
  const isCuratedError = curatedOutfitsQuery.isError

  const recentStyleItems = useMemo(
    () =>
      recentStyles.map((entry) => {
        const item = buildInspirationFromEntry(entry)
        const outfitId = item.outfitId ?? entry.outfit.id
        return {
          ...item,
          showSaveButton: true,
          isSaved: outfitId ? favoriteIds.includes(outfitId) : false,
        }
      }),
    [buildInspirationFromEntry, favoriteIds, recentStyles],
  )

  const curatedStyleItems = useMemo(
    () =>
      curatedOutfits.map((entry) => {
        const item = buildInspirationFromEntry(entry)
        const outfitId = item.outfitId ?? entry.outfit.id
        return {
          ...item,
          showSaveButton: true,
          isSaved: outfitId ? favoriteIds.includes(outfitId) : false,
        }
      }),
    [buildInspirationFromEntry, curatedOutfits, favoriteIds],
  )
  const isFavoritesActive = activeMoodboardId === "favorites"
  const filteredRecentItems = useMemo(
    () => (isFavoritesActive ? recentStyleItems.filter((item) => item.outfitId && favoriteIds.includes(item.outfitId)) : recentStyleItems),
    [favoriteIds, isFavoritesActive, recentStyleItems],
  )
  const filteredCuratedItems = useMemo(
    () => (isFavoritesActive ? curatedStyleItems.filter((item) => item.outfitId && favoriteIds.includes(item.outfitId)) : curatedStyleItems),
    [curatedStyleItems, favoriteIds, isFavoritesActive],
  )
  const shouldShowRecentStylesSection = isRecentLoading || isRecentError || filteredRecentItems.length > 0

  const tryOnItems = useMemo(() => (tryOnsQuery.data?.pages ?? []).flat(), [tryOnsQuery.data?.pages])
  const selectedTryOn = selectedTryOnIndex !== null ? tryOnItems[selectedTryOnIndex] : null

  const collectionsOverviewQuery = useCollectionsOverview()
  const moodboards = collectionsOverviewQuery.data?.moodboards ?? []
  const selectableMoodboards = useMemo(
    () => moodboards.filter((m) => !m.isSystem || m.slug === "wardrobe"),
    [moodboards],
  )
  const prefetchMoodboardSlugs = useMemo(() => {
    const slugs = selectableMoodboards.map((m) => m.slug)
    const filtered = activeMoodboardId ? slugs.filter((slug) => slug !== activeMoodboardId) : slugs
    const unique = Array.from(new Set(filtered))
    return unique.slice(0, 3)
  }, [activeMoodboardId, selectableMoodboards])

  const isUserMoodboardActive = useMemo(
    () => moodboards.some((board) => board.slug === activeMoodboardId && !board.isSystem),
    [activeMoodboardId, moodboards],
  )
  const isWardrobeActive = activeMoodboardId === "wardrobe"
  const isItemMoodboardActive = isUserMoodboardActive || isWardrobeActive

  const moodboardItemsQuery = useMoodboardItems(
    isItemMoodboardActive ? activeMoodboardId : null,
    MOODBOARD_PAGE_SIZE,
    isItemMoodboardActive,
  )

  const moodboardItems = useMemo(() => {
    const pages = moodboardItemsQuery.data?.pages ?? []
    return pages.flat()
  }, [moodboardItemsQuery.data?.pages])

  const favoritesItemsQuery = useMoodboardItems(
    activeMoodboardId === "favorites" ? "favorites" : null,
    MOODBOARD_PAGE_SIZE,
    activeMoodboardId === "favorites",
  )

  const favoritesItems = useMemo(() => {
    const pages = favoritesItemsQuery.data?.pages ?? []
    return pages.flat()
  }, [favoritesItemsQuery.data?.pages])

  const moodboardTabs = useMemo<MoodboardTab[]>(() => {
    const systemOrder = ["wardrobe", "try-ons", "favorites", "for-you"]
    const labels: Record<string, string> = {
      wardrobe: "Wardrobe",
      "try-ons": "Try-ons",
      favorites: "Favorites",
      "for-you": "For You",
    }
    const systemTabs: MoodboardTab[] = systemOrder.map((slug) => ({
      id: slug,
      label: labels[slug] ?? slug,
    }))

    const userTabs = moodboards
      .filter((m) => !m.isSystem)
      .map((m) => ({ id: m.slug, label: m.label }))

    return [...systemTabs, ...userTabs]
  }, [moodboards])

  const activeMoodboardLabel = useMemo(
    () => moodboardTabs.find((tab) => tab.id === activeMoodboardId)?.label ?? "Moodboard",
    [activeMoodboardId, moodboardTabs],
  )

  const handleScroll = useCallback(
    (scrollTop: number) => {
      if (scrollTop <= 0) {
        setIsTopBarVisible(true)
        lastScrollTopRef.current = 0
        return
      }

      const delta = scrollTop - lastScrollTopRef.current
      const threshold = 6

      if (delta > threshold) {
        setIsTopBarVisible(false)
        lastScrollTopRef.current = scrollTop
        return
      }

      if (delta < -threshold) {
        setIsTopBarVisible(true)
        lastScrollTopRef.current = scrollTop
      }
    },
    [setIsTopBarVisible],
  )

  useEffect(() => {
    lastScrollTopRef.current = 0
    setIsTopBarVisible(true)
  }, [isResultsMode])

  useEffect(() => {
    const handleWindowScroll = () => {
      handleScroll(window.scrollY)
    }

    window.addEventListener("scroll", handleWindowScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleWindowScroll)
    }
  }, [handleScroll])

  useEffect(() => {
    const availableIds = moodboardTabs.map((tab) => tab.id)
    const nextUserId = user?.id ?? null
    const wasLoggedOut = lastUserIdRef.current === null
    const justLoggedIn = wasLoggedOut && Boolean(nextUserId)
    lastUserIdRef.current = nextUserId

    if (justLoggedIn && !moodboardParam && availableIds.includes("for-you")) {
      setActiveMoodboardId("for-you")
      sessionStorage.setItem("home:activeMoodboard", "for-you")
      const params = new URLSearchParams(searchParams)
      params.set("moodboard", "for-you")
      setSearchParams(params, { replace: true })
      return
    }

    // Use URL param if present, otherwise sync URL with current state (from sessionStorage)
    if (moodboardParam && availableIds.includes(moodboardParam)) {
      setActiveMoodboardId((prev) => (prev === moodboardParam ? prev : moodboardParam))
    } else if (availableIds.includes(activeMoodboardId)) {
      // No URL param - sync URL with the persisted/current moodboard
      const params = new URLSearchParams(searchParams)
      params.set("moodboard", activeMoodboardId)
      setSearchParams(params, { replace: true })
    }
  }, [activeMoodboardId, moodboardParam, moodboardTabs, searchParams, setSearchParams, user?.id])

  useEffect(() => {
    if (!user?.id || prefetchMoodboardSlugs.length === 0) {
      return
    }
    let cancelled = false
    const slugs = [...prefetchMoodboardSlugs].sort()
    const signature = `${user.id}:${slugs.join(",")}:${MOODBOARD_PAGE_SIZE}`
    if (lastMoodboardPrefetchKeyRef.current === signature) {
      return
    }
    lastMoodboardPrefetchKeyRef.current = signature

    fetchMoodboardItemsBatch({
      userId: user.id,
      slugs,
      page: 0,
      size: MOODBOARD_PAGE_SIZE,
    })
      .then((grouped) => {
        if (cancelled) return
        slugs.forEach((slug) => {
          const cacheKey = collectionsKeys.moodboardItems(slug, MOODBOARD_PAGE_SIZE)
          const existing = queryClient.getQueryData(cacheKey)
          if (existing) return
          const items = grouped[slug] ?? []
          queryClient.setQueryData(cacheKey, { pages: [items], pageParams: [0] })
        })
      })
      .catch(() => {
        // Ignore prefetch errors to avoid blocking the Home screen.
      })

    return () => {
      cancelled = true
    }
  }, [MOODBOARD_PAGE_SIZE, prefetchMoodboardSlugs, queryClient, user?.id])

  const outfitResultItems = useMemo(() => {
    const resolvedGender = profileGender ?? "female"
    const resolvedHeight = heightCm ?? 170
    const pages = outfitResultsQuery.data?.pages ?? []

    return pages
      .flatMap((page) => page.results)
      .map((result) => ({
        id: result.outfit.id,
        variant: "narrow" as const,
        title: result.outfit.name,
        chips: getOutfitChips(result.outfit),
        attribution: resolveOutfitAttribution(result.outfit.created_by),
        outfitId: result.outfit.id,
        renderedItems: result.studioOutfit?.renderedItems ?? mapLegacyOutfitItemsToStudioItems(result.outfit.items),
        items: result.outfit.items,
        gender: resolvedGender,
        heightCm: resolvedHeight,
        showTitle: true,
        showChips: true,
        showSaveButton: true,
        isSaved: favoriteIds.includes(result.outfit.id),
        outfit: result.outfit,
      }))
  }, [favoriteIds, heightCm, outfitResultsQuery.data?.pages, profileGender])

  const productResultItems = useMemo(
    () =>
      (productResultsQuery.data?.pages ?? [])
        .flatMap((page) => page.results)
        .map((result) => {
          const saved = productSaveActions.isSaved(result.id)
          return {
            id: result.id,
            imageSrc: result.imageSrc,
            title: result.title,
            brand: result.brand,
            price: result.priceLabel,
            isSaved: saved,
            onToggleSave: () => productSaveActions.onToggleSave(result.id, !saved),
            onLongPressSave: () => productSaveActions.onLongPressSave(result.id),
          }
        }),
    [productResultsQuery.data?.pages, productSaveActions],
  )

  const launchStudio = useLaunchStudio()

  const handleInspirationSelect = useCallback(
    (item: InspirationItem) => {
      if (item.outfit) {
        launchStudio(item.outfit)
      }
    },
    [launchStudio],
  )

  const originPath = useMemo(
    () => `${location.pathname}${location.search}` || "/home",
    [location.pathname, location.search],
  )

  const handleProductSelect = useCallback(
    (productId: string) => {
      const params = new URLSearchParams()
      params.set("returnTo", encodeURIComponent(originPath))
      const search = params.toString()
      navigate(`/studio/product/${encodeURIComponent(productId)}${search ? `?${search}` : ""}`)
    },
    [navigate, originPath],
  )

  const handleOpenStudioFromTryOn = useCallback(
    (item: TryOn) => {
      if (!item.outfitId) {
        return
      }
      const url = buildStudioUrl("/studio", "studio", { outfitId: item.outfitId })
      navigate(url)
    },
    [navigate],
  )

  const handleTryOnSelect = useCallback((_item: TryOn, index: number) => {
    setSelectedTryOnIndex(index)
  }, [])

  useEffect(() => {
    if (selectedTryOnIndex === null) return
    if (tryOnItems.length === 0) {
      setSelectedTryOnIndex(null)
      return
    }
    if (selectedTryOnIndex >= tryOnItems.length) {
      setSelectedTryOnIndex(tryOnItems.length - 1)
    }
  }, [selectedTryOnIndex, tryOnItems.length])

  const handleToggleOutfitById = useCallback(
    async (outfitId: string, nextSaved: boolean) => {
      try {
        if (nextSaved) {
          await saveToCollectionMutation.mutateAsync({ outfitId, slug: "favorites", label: "Favorites" })
        } else {
          await removeOutfitFromLibraryMutation.mutateAsync({ outfitId })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update favorite"
        toast({ title: "Save failed", description: message, variant: "destructive" })
        favoritesQuery.refetch()
      }
    },
    [favoritesQuery, removeOutfitFromLibraryMutation, saveToCollectionMutation, toast],
  )

  const handleLongPressOutfitById = useCallback(
    async (outfitId: string) => {
      try {
        await saveToCollectionMutation.mutateAsync({ outfitId, slug: "favorites", label: "Favorites" })
        setPendingOutfitId(outfitId)
        setIsMoodboardPickerOpen(true)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to save outfit"
        toast({ title: "Save failed", description: message, variant: "destructive" })
      }
    },
    [saveToCollectionMutation, toast],
  )

  const handleToggleFavorite = useCallback(
    (item: InspirationItem, nextSaved: boolean) => {
      const outfitId = item.outfitId ?? item.outfit?.id ?? null
      if (!outfitId) return
      handleToggleOutfitById(outfitId, nextSaved)
    },
    [handleToggleOutfitById],
  )

  const handleLongPressSave = useCallback(
    (item: InspirationItem) => {
      const outfitId = item.outfitId ?? item.outfit?.id ?? null
      if (!outfitId) return
      handleLongPressOutfitById(outfitId)
    },
    [handleLongPressOutfitById],
  )

  const isOutfitResultsLoading = outfitResultsQuery.isLoading
  const isOutfitResultsError = outfitResultsQuery.isError
  const isProductResultsLoading = productResultsQuery.isLoading
  const isProductResultsError = productResultsQuery.isError
  const isFetchingMore =
    activeFilter === "outfits" ? outfitResultsQuery.isFetchingNextPage : productResultsQuery.isFetchingNextPage
  const isTryOnLoading = tryOnsQuery.isLoading
  const isTryOnError = tryOnsQuery.isError
  const isTryOnFetchingMore = tryOnsQuery.isFetchingNextPage
  const isPickerBusy = saveToCollectionMutation.isPending || createMoodboardMutation.isPending

  const updateUrlState = useCallback(
    (nextSearch: string, nextMode: "products" | "outfits") => {
      const trimmed = nextSearch.trim()
      // Always navigate to /search route for search results, regardless of current page
      // Use push instead of replace to create history entry for browser back
      if (trimmed.length > 0 || uploadedImageUrl) {
        const params = new URLSearchParams()
        if (trimmed.length > 0) {
          params.set("search", trimmed)
        }
        if (uploadedImageUrl) {
          params.set("imageUrl", encodeURIComponent(uploadedImageUrl))
        }
        params.set("mode", nextMode)
        navigate(`/search?${params.toString()}`, { replace: false })
      } else {
        // When clearing search, stay on current page but clear params
        setSearchParams(new URLSearchParams(), { replace: false })
      }
    },
    [navigate, setSearchParams, uploadedImageUrl],
  )

  const handleImageUpload = async (file: File) => {
    try {
      setIsUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `search-images/${fileName}`

      const { error: uploadError } = await supabase.storage.from('public-files').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('public-files').getPublicUrl(filePath)
      const publicUrl = data.publicUrl

      // Store image URL locally, don't navigate - wait for user to submit
      setUploadedImageUrl(publicUrl)
      setActiveFilter("products")

    } catch (error) {
      console.error("Image upload failed:", error)
      toast({ title: "Upload failed", description: "Could not upload image", variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }

  // Redirect to search page if query params present
  useEffect(() => {
    const hasQuery = searchParamValue.trim().length > 0

    // On home page, if there's a search query, navigate to /search instead
    if (hasQuery && location.pathname === "/home") {
      navigate(`/search?search=${encodeURIComponent(searchParamValue)}&mode=${modeParamValue}`, { replace: true })
      return
    }

    // Sync local state with URL params
    setSearchTerm((prev) => (prev === searchParamValue ? prev : searchParamValue))

    if (hasQuery) {
      setActiveFilter((prev) => {
        const target = modeParamValue
        return prev === target ? prev : target
      })
    } else {
      setActiveFilter("outfits")
    }
  }, [location.pathname, modeParamValue, navigate, searchParamValue])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node) {
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || !isResultsMode) {
        return
      }

      if (activeFilter === "outfits") {
        if (outfitResultsQuery.hasNextPage && !outfitResultsQuery.isFetchingNextPage) {
          outfitResultsQuery.fetchNextPage()
        }
      } else if (productResultsQuery.hasNextPage && !productResultsQuery.isFetchingNextPage) {
        productResultsQuery.fetchNextPage()
      }
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [
    activeFilter,
    isResultsMode,
    outfitResultsQuery.fetchNextPage,
    outfitResultsQuery.hasNextPage,
    outfitResultsQuery.isFetchingNextPage,
    productResultsQuery.fetchNextPage,
    productResultsQuery.hasNextPage,
    productResultsQuery.isFetchingNextPage,
  ])

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value)
      // Only update local state, don't trigger URL changes or navigation
      // Search is only triggered on explicit submit (like SearchScreen)
    },
    [],
  )

  const handleSubmit = useCallback(() => {
    const trimmed = searchTerm.trim()
    // Allow submit with image even if text is empty
    if (trimmed.length === 0 && !uploadedImageUrl) {
      return
    }

    // Prevent Home from firing the product query while we navigate
    setIsSearchSubmitting(true)

    // Navigate to /search route when submitting a search query
    const nextMode = activeFilter
    updateUrlState(trimmed, nextMode)

    // Safety: reset flag in case the component remains mounted briefly
    setTimeout(() => setIsSearchSubmitting(false), 1000)
  }, [activeFilter, searchTerm, uploadedImageUrl, updateUrlState])

  const handleClear = useCallback(() => {
    setSearchTerm("")
    // Only clear the input field, don't trigger URL changes
    // This matches SearchScreen behavior - results stay visible until submit
    // If there's no uploaded image, we can reset back to browse mode
    if (!uploadedImageUrl) {
      setSearchParams(new URLSearchParams(), { replace: false })
    }
  }, [uploadedImageUrl, setSearchParams])

  const handleFilterChange = useCallback(
    (next: "products" | "outfits") => {
      setActiveFilter(next)
      // Only update local state, don't trigger navigation
      // This matches SearchScreen behavior - filter toggle only changes view mode
    },
    [],
  )

  const handleFilterToggle = useCallback(() => {
    // Toggle between products and outfits
    const next = activeFilter === "products" ? "outfits" : "products"
    handleFilterChange(next)
  }, [activeFilter, handleFilterChange])

  const handleClearImage = useCallback(() => {
    setUploadedImageUrl(undefined)
  }, [])

  const filterChips = useMemo<FilterSearchBarChip[]>(
    () => [
      {
        id: "products",
        label: "Products",
        isActive: activeFilter === "products",
        onActivate: () => handleFilterChange("products"),
        onDeactivate: () => handleFilterToggle(),
      },
      {
        id: "outfits",
        label: "Outfits",
        isActive: activeFilter === "outfits",
        onActivate: () => handleFilterChange("outfits"),
        onDeactivate: () => handleFilterToggle(),
      },
    ],
    [activeFilter, handleFilterChange, handleFilterToggle],
  )

  const handleMoodboardSelect = useCallback(
    (nextId: string) => {
      setActiveMoodboardId(nextId)
      sessionStorage.setItem("home:activeMoodboard", nextId)
      const params = new URLSearchParams(searchParams)
      params.set("moodboard", nextId)
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const handleMoodboardPickerSelect = useCallback(
    async (slug: string) => {
      if (!pendingOutfitId) return
      const label = selectableMoodboards.find((board) => board.slug === slug)?.label ?? slug
      try {
        await saveToCollectionMutation.mutateAsync({ outfitId: pendingOutfitId, slug, label })
        setPendingOutfitId(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to add to moodboard"
        toast({ title: "Add failed", description: message, variant: "destructive" })
      }
    },
    [pendingOutfitId, saveToCollectionMutation, selectableMoodboards, toast],
  )

  const handleMoodboardPickerApply = useCallback(
    async (slugs: string[]) => {
      if (!pendingOutfitId) return
      try {
        for (const slug of slugs) {
          const label = selectableMoodboards.find((board) => board.slug === slug)?.label ?? slug
          await saveToCollectionMutation.mutateAsync({ outfitId: pendingOutfitId, slug, label })
        }
        setPendingOutfitId(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to add to moodboards"
        toast({ title: "Add failed", description: message, variant: "destructive" })
      }
    },
    [pendingOutfitId, saveToCollectionMutation, selectableMoodboards, toast],
  )

  const handleCreateMoodboard = useCallback(
    async (name: string) => {
      const result = await createMoodboardMutation.mutateAsync(name)
      return result.slug
    },
    [createMoodboardMutation],
  )

  const renderResultPlaceholder = (message: string, variant: "default" | "error" = "default") => (
    <div
      className={cn(
        "flex flex-1 items-center justify-center rounded-2xl border px-4 py-6 text-sm",
        variant === "error"
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-dashed border-muted-foreground/30 bg-muted/10 text-muted-foreground",
      )}
    >
      {message}
    </div>
  )

  const renderTryOnsContent = () => {
    if (isTryOnLoading) {
      return (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted/70 shadow-inner" />
          ))}
        </div>
      )
    }

    if (isTryOnError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          Unable to load try-ons right now.
          <Button variant="secondary" size="sm" onClick={() => tryOnsQuery.refetch()}>
            Retry
          </Button>
        </div>
      )
    }

    if (tryOnItems.length === 0) {
      return renderResultPlaceholder("No try-ons yet. Generate a look to see it here.")
    }

    return (
      <div className="flex flex-col gap-4">
        <TryOnGrid items={tryOnItems} onSelect={handleTryOnSelect} onOpenStudio={handleOpenStudioFromTryOn} />
        {tryOnsQuery.hasNextPage ? (
          <Button
            variant="secondary"
            size="sm"
            className="self-center"
            disabled={isTryOnFetchingMore}
            onClick={() => tryOnsQuery.fetchNextPage()}
          >
            {isTryOnFetchingMore ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </div>
    )
  }

  const renderOutfitResultsContent = () => {
    if (isOutfitResultsLoading) {
      return renderResultPlaceholder("Searching outfits…")
    }
    if (isOutfitResultsError) {
      return renderResultPlaceholder("Unable to fetch outfits right now.", "error")
    }
    if (outfitResultItems.length === 0) {
      return renderResultPlaceholder("No outfits match this query yet.")
    }

    return (
      <OutfitInspirationGrid
        items={outfitResultItems}
        columns={2}
        rows={10}
        layoutMode="balanced"
        cardTotalHeight={190}
        cardVerticalGap={4}
        cardMinAvatarHeight={128}
        fixedAvatarHeight={156}
        onCardSelect={handleInspirationSelect}
        onToggleSave={handleToggleFavorite}
        onLongPressSave={handleLongPressSave}
      />
    )
  }

  const renderProductResultsContent = () => {
    if (isProductResultsLoading) {
      return renderResultPlaceholder("Searching products…")
    }
    if (isProductResultsError) {
      return renderResultPlaceholder("Unable to fetch products right now.", "error")
    }
    if (productResultItems.length === 0) {
      return renderResultPlaceholder("No products match this query yet.")
    }

    return (
      <ProductResultsGrid
        items={productResultItems}
        columns={2}
        rows={8}
        onItemSelect={(item) => handleProductSelect(item.id)}
      />
    )
  }

  const renderRecentStylesContent = () => {
    // Only show loading state if we have no cached data
    if (isRecentLoading && filteredRecentItems.length === 0) {
      return renderResultPlaceholder("Loading your recent styles…")
    }
    if (isRecentError) {
      return renderResultPlaceholder("Unable to load recent styles right now.", "error")
    }
    if (filteredRecentItems.length === 0) {
      return renderResultPlaceholder("No recent styles yet. Start exploring outfits!")
    }

    return (
      <RecentStylesRail
        items={filteredRecentItems}
        onCardSelect={handleInspirationSelect}
        onToggleSave={handleToggleFavorite}
        onLongPressSave={handleLongPressSave}
      />
    )
  }

  const renderCuratedGrid = () => {
    // Only show loading state if we have no cached data
    if (isCuratedLoading && filteredCuratedItems.length === 0) {
      return renderResultPlaceholder("Curating outfits for you…")
    }
    if (isCuratedError) {
      return renderResultPlaceholder("Unable to load curated outfits right now.", "error")
    }
    if (filteredCuratedItems.length === 0) {
      return renderResultPlaceholder("No curated outfits available yet.")
    }

    return (
      <OutfitInspirationGrid
        items={filteredCuratedItems}
        columns={2}
        rows={8}
        layoutMode="balanced"
        cardTotalHeight={320}
        cardVerticalGap={2}
        cardMinAvatarHeight={128}
        fixedAvatarHeight={156}
        cardPreset="homeCurated"
        onCardSelect={handleInspirationSelect}
        onToggleSave={handleToggleFavorite}
        onLongPressSave={handleLongPressSave}
      />
    )
  }

  const renderMoodboardItemsContent = () => {
    if (moodboardItemsQuery.isLoading) {
      return renderResultPlaceholder("Loading moodboard items…")
    }
    if (moodboardItemsQuery.isError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          Unable to load this moodboard right now.
          <Button variant="secondary" size="sm" onClick={() => moodboardItemsQuery.refetch()}>
            Retry
          </Button>
        </div>
      )
    }
    if (moodboardItems.length === 0) {
      return renderResultPlaceholder("No items in this moodboard yet.")
    }

    return (
      <div className="flex flex-col gap-4">
        <MixedMasonryGrid
          items={moodboardItems}
          favoriteOutfitIds={favoriteIds}
          onOutfitSelect={(item) => {
            if (item.itemType === "outfit" && item.outfit) {
              launchStudio(item.outfit)
            }
          }}
          onToggleOutfitSave={(outfitId, nextSaved) => handleToggleOutfitById(outfitId, nextSaved)}
          onLongPressOutfitSave={(outfitId) => handleLongPressOutfitById(outfitId)}
          onProductSelect={handleProductSelect}
          isProductSaved={productSaveActions.isSaved}
          onToggleProductSave={(productId, nextSaved) =>
            productSaveActions.onToggleSave(productId, nextSaved)
          }
          onLongPressProductSave={(productId) => productSaveActions.onLongPressSave(productId)}
        />
        {moodboardItemsQuery.hasNextPage ? (
          <Button
            variant="secondary"
            size="sm"
            className="self-center"
            disabled={moodboardItemsQuery.isFetchingNextPage}
            onClick={() => moodboardItemsQuery.fetchNextPage()}
          >
            {moodboardItemsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </div>
    )
  }

  const renderFavoritesItemsContent = () => {
    // Only show loading state if we have no cached data
    if (favoritesItemsQuery.isLoading && favoritesItems.length === 0) {
      return renderResultPlaceholder("Loading favorites…")
    }
    if (favoritesItemsQuery.isError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          Unable to load favorites right now.
          <Button variant="secondary" size="sm" onClick={() => favoritesItemsQuery.refetch()}>
            Retry
          </Button>
        </div>
      )
    }
    if (favoritesItems.length === 0) {
      return renderResultPlaceholder("No favorites yet.")
    }

    return (
      <div className="flex flex-col gap-4">
        <MixedMasonryGrid
          items={favoritesItems}
          favoriteOutfitIds={favoriteIds}
          onOutfitSelect={(item) => {
            if (item.itemType === "outfit" && item.outfit) {
              launchStudio(item.outfit)
            }
          }}
          onToggleOutfitSave={(outfitId, nextSaved) => handleToggleOutfitById(outfitId, nextSaved)}
          onLongPressOutfitSave={(outfitId) => handleLongPressOutfitById(outfitId)}
          onProductSelect={handleProductSelect}
          isProductSaved={productSaveActions.isSaved}
          onToggleProductSave={(productId, nextSaved) => productSaveActions.onToggleSave(productId, nextSaved)}
          onLongPressProductSave={(productId) => productSaveActions.onLongPressSave(productId)}
        />
        {favoritesItemsQuery.hasNextPage ? (
          <Button
            variant="secondary"
            size="sm"
            className="self-center"
            disabled={favoritesItemsQuery.isFetchingNextPage}
            onClick={() => favoritesItemsQuery.fetchNextPage()}
          >
            {favoritesItemsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-start">
      <div
        className={cn(
          `flex w-full max-w-[${CARD_MAX_WIDTH}] flex-1 flex-col rounded-[2rem] bg-card shadow-sm`,
          isResultsMode ? "pt-[4.5rem]" : "",
        )}
      >
        {isResultsMode ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 overflow-hidden">
              <div
                className="flex flex-1 flex-col overflow-y-auto px-2 pb-6 pt-2 scrollbar-hide"
                onScroll={(event) => handleScroll(event.currentTarget.scrollTop)}
              >
                {activeFilter === "products" ? renderProductResultsContent() : renderOutfitResultsContent()}
                <div ref={loadMoreRef} className="h-6 w-full" />
                {isFetchingMore ? renderResultPlaceholder("Loading more...") : null}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-24 pt-14"
            onScroll={(event) => handleScroll(event.currentTarget.scrollTop)}
          >
            <div
              className={cn(
                "fixed top-4 left-4 right-4 z-10 transition-transform transition-opacity duration-200",
                isTopBarVisible ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0 pointer-events-none",
              )}
            >
              <MoodboardPins
                tabs={moodboardTabs}
                activeTabId={activeMoodboardId}
                onTabSelect={handleMoodboardSelect}
              />
            </div>
            {activeMoodboardId === "try-ons" ? (
              <>
                <SectionHeader title="Try-ons" />
                {renderTryOnsContent()}
              </>
            ) : activeMoodboardId === "favorites" ? (
              <>
                <SectionHeader title="Favorites" />
                {renderFavoritesItemsContent()}
              </>
            ) : isItemMoodboardActive ? (
              <>
                <SectionHeader title={activeMoodboardLabel} />
                {renderMoodboardItemsContent()}
              </>
            ) : (
              <>
                {shouldShowRecentStylesSection ? (
                  <>
                    <SectionHeader title="Recent Styles by you" />
                    {renderRecentStylesContent()}
                  </>
                ) : null}
                <SectionHeader title="Outfits curated for you" />
                <div className="px-1 py-2">{renderCuratedGrid()}</div>
              </>
            )}
          </div>
        )}
      </div>

      {!isResultsMode && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[3rem] z-10">
          <div className="pointer-events-auto mx-auto w-full px-2" style={{ maxWidth: CARD_MAX_WIDTH }}>
            <FilterSearchBar
              className="rounded-t-3xl"
              value={searchTerm}
              onValueChange={handleSearchChange}
              filters={isSearchFocused ? filterChips : undefined}
              pillPosition={isSearchFocused ? "top" : "none"}
              variant="elevated"
              onSubmit={handleSubmit}
              onClear={handleClear}
              placeholder={isSearchFocused 
                ? (activeFilter === "products" ? "Search products..." : "Search outfits...") 
                : "Discover your next look"
              }
              trailingAction={searchTerm.trim().length > 0 ? undefined : null}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              
              onImageUpload={handleImageUpload}
              isUploadingImage={isUploading}
              previewImageUrl={uploadedImageUrl}
              onClearImage={handleClearImage}
              showCompactPreview={false}

              leadingActions={null}
            />
          </div>
        </div>
      )}

      {isResultsMode && (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 top-[0.5rem] z-10 transition-transform transition-opacity duration-200",
            isTopBarVisible ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0",
          )}
        >
          <div
            className={cn("pointer-events-auto mx-auto w-full px-2", !isTopBarVisible && "pointer-events-none")}
            style={{ maxWidth: CARD_MAX_WIDTH }}
          >
            <FilterSearchBar
              className="rounded-b-3xl"
              value={searchTerm}
              onValueChange={handleSearchChange}
              filters={filterChips}
              pillPosition="bottom"
              variant="elevated"
              onSubmit={handleSubmit}
              onClear={handleClear}
              placeholder={activeFilter === "products" ? "Search products" : "Search outfits"}
              trailingAction={searchTerm.trim().length > 0 ? undefined : null}
              
              onImageUpload={handleImageUpload}
              isUploadingImage={isUploading}
              previewImageUrl={uploadedImageUrl}
              onClearImage={handleClearImage}
              showCompactPreview={isResultsMode}

              leadingActions={null}
            />
          </div>
        </div>
      )}


      <MoodboardPickerDrawer
        open={isMoodboardPickerOpen}
        onOpenChange={(open) => {
          setIsMoodboardPickerOpen(open)
          if (!open) {
            setPendingOutfitId(null)
          }
        }}
        moodboards={selectableMoodboards}
        mode="multi"
        onSelect={handleMoodboardPickerSelect}
        onApply={handleMoodboardPickerApply}
        onCreate={handleCreateMoodboard}
        isSaving={isPickerBusy}
        title="Add to moodboard"
      />

      <MoodboardPickerDrawer
        open={productSaveActions.isPickerOpen}
        onOpenChange={(open) => {
          if (!open) {
            productSaveActions.closePicker()
          }
        }}
        moodboards={productSaveActions.moodboards}
        mode="multi"
        onSelect={() => { }}
        onApply={productSaveActions.onApplyMoodboards}
        onCreate={productSaveActions.onCreateMoodboard}
        isSaving={productSaveActions.isSaving}
        title="Add to moodboard"
      />

      {selectedTryOn && selectedTryOnIndex !== null ? (
        <TryOnPreviewOverlay
          items={tryOnItems}
          activeIndex={selectedTryOnIndex}
          onClose={() => setSelectedTryOnIndex(null)}
          onIndexChange={setSelectedTryOnIndex}
          onOpenStudio={handleOpenStudioFromTryOn}
        />
      ) : null}
    </div>
  )
}

export function HomeScreen() {
  return (
    <AppShellLayout>
      <HomeScreenView />
    </AppShellLayout>
  )
}
