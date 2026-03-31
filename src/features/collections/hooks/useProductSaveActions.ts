import { useCallback, useMemo, useState } from "react"

import { useToast } from "@/hooks/use-toast"
import {
  useCreateMoodboard,
  useFavoriteProducts,
  useCollectionsOverview,
  useRemoveProductFromLibrary,
  useSaveProductToCollection,
} from "@/features/collections/hooks/useMoodboards"
import type { Moodboard } from "@/services/collections/collectionsService"

type SaveActionState = {
  isPickerOpen: boolean
  pendingProductId: string | null
}

export function useProductSaveActions() {
  const { toast } = useToast()
  const favoritesQuery = useFavoriteProducts()
  const saveMutation = useSaveProductToCollection()
  const removeMutation = useRemoveProductFromLibrary()
  const createMoodboardMutation = useCreateMoodboard()
  const collectionsOverviewQuery = useCollectionsOverview()
  const moodboards = collectionsOverviewQuery.data?.moodboards ?? []
  const selectableMoodboards = useMemo(
    () => moodboards.filter((m) => !m.isSystem || m.slug === "wardrobe"),
    [moodboards],
  )

  const [state, setState] = useState<SaveActionState>({
    isPickerOpen: false,
    pendingProductId: null,
  })

  const favoriteIds = useMemo(() => favoritesQuery.data ?? [], [favoritesQuery.data])
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  const isSaved = useCallback((productId: string) => favoriteSet.has(productId), [favoriteSet])

  const handleToggleSave = useCallback(
    async (productId: string, nextSaved: boolean) => {
      try {
        if (nextSaved) {
          await saveMutation.mutateAsync({ productId, slug: "favorites", label: "Favorites" })
        } else {
          await removeMutation.mutateAsync({ productId })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update favorite"
        toast({ title: "Save failed", description: message, variant: "destructive" })
        favoritesQuery.refetch()
      }
    },
    [favoritesQuery, removeMutation, saveMutation, toast],
  )

  const handleLongPressSave = useCallback(
    async (productId: string) => {
      try {
        await saveMutation.mutateAsync({ productId, slug: "favorites", label: "Favorites" })
        setState({ isPickerOpen: true, pendingProductId: productId })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to save product"
        toast({ title: "Save failed", description: message, variant: "destructive" })
      }
    },
    [saveMutation, toast],
  )

  const handleApplyMoodboards = useCallback(
    async (selectedSlugs: string[]) => {
      if (!state.pendingProductId) return
      if (!selectedSlugs.length) {
        toast({ title: "Select moodboards and try again." })
        return
      }

      const labelBySlug = new Map(selectableMoodboards.map((moodboard) => [moodboard.slug, moodboard.label]))
      let hadError = false

      for (const slug of selectedSlugs) {
        try {
          await saveMutation.mutateAsync({
            productId: state.pendingProductId,
            slug,
            label: labelBySlug.get(slug),
          })
        } catch {
          hadError = true
        }
      }

      setState({ isPickerOpen: false, pendingProductId: null })

      if (hadError) {
        toast({
          title: "Saved with issues",
          description: "Saved product, but could not add it to all moodboards.",
          variant: "destructive",
        })
      }
    },
    [selectableMoodboards, saveMutation, state.pendingProductId, toast],
  )

  const handleCreateMoodboard = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      try {
        const created = await createMoodboardMutation.mutateAsync(trimmed)
        const slug = typeof created === "object" && created?.slug ? created.slug : null
        if (slug && state.pendingProductId) {
          await saveMutation.mutateAsync({ productId: state.pendingProductId, slug, label: created?.label })
        }
        return slug
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not create moodboard"
        toast({ title: "Create failed", description: message, variant: "destructive" })
        return undefined
      }
    },
    [createMoodboardMutation, saveMutation, state.pendingProductId, toast],
  )

  const closePicker = useCallback(() => {
    setState({ isPickerOpen: false, pendingProductId: null })
  }, [])

  return {
    moodboards: selectableMoodboards as Moodboard[],
    favoriteIds,
    isSaved,
    onToggleSave: handleToggleSave,
    onLongPressSave: handleLongPressSave,
    onApplyMoodboards: handleApplyMoodboards,
    onCreateMoodboard: handleCreateMoodboard,
    isPickerOpen: state.isPickerOpen,
    pendingProductId: state.pendingProductId,
    closePicker,
    isSaving: saveMutation.isPending || createMoodboardMutation.isPending,
  }
}
