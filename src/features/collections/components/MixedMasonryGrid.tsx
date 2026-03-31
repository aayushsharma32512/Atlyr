import { useMemo } from "react"

import { cn } from "@/lib/utils"
import { OutfitInspirationTile, ProductAlternateCard } from "@/design-system/primitives"
import type { MoodboardItem } from "@/services/collections/collectionsService"
import { resolveOutfitAttribution } from "@/utils/outfitAttribution"
import { getOutfitChips } from "@/utils/outfitChips"

const PRICE_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

type MixedMasonryGridProps = {
  items: MoodboardItem[]
  favoriteOutfitIds?: string[]
  onOutfitSelect?: (item: MoodboardItem) => void
  onToggleOutfitSave?: (outfitId: string, nextSaved: boolean) => void
  onLongPressOutfitSave?: (outfitId: string) => void
  onProductSelect?: (productId: string) => void
  isProductSaved?: (productId: string) => boolean
  onToggleProductSave?: (productId: string, nextSaved: boolean) => void
  onLongPressProductSave?: (productId: string) => void
  className?: string
}

export function MixedMasonryGrid({
  items,
  favoriteOutfitIds = [],
  onOutfitSelect,
  onToggleOutfitSave,
  onLongPressOutfitSave,
  onProductSelect,
  isProductSaved,
  onToggleProductSave,
  onLongPressProductSave,
  className,
}: MixedMasonryGridProps) {
  const favoriteSet = useMemo(() => new Set(favoriteOutfitIds), [favoriteOutfitIds])

  const [leftColumn, rightColumn] = useMemo(() => {
    const left: MoodboardItem[] = []
    const right: MoodboardItem[] = []
    items.forEach((item, index) => {
      if (index % 2 === 0) {
        left.push(item)
      } else {
        right.push(item)
      }
    })
    return [left, right] as const
  }, [items])

  const formatPrice = (price: number | null | undefined, currency: string | null | undefined) => {
    if (typeof price !== "number") return "—"
    if (!currency || currency === "INR") {
      return PRICE_FORMATTER.format(price)
    }
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(price)
  }

  const renderItem = (item: MoodboardItem) => {
    if (item.itemType === "outfit") {
      const isSaved = favoriteSet.has(item.id)
      const title = item.outfit?.name ?? "Moodboard look"
      const chips = getOutfitChips(item.outfit)
      const gender = item.gender ?? "female"
      return (
        <OutfitInspirationTile
          key={`${item.itemType}-${item.id}-${item.createdAt}`}
          preset="gridMeta"
          wrapperClassName="flex flex-col gap-1"
          wrapperProps={{
            role: onOutfitSelect ? "button" : undefined,
            tabIndex: onOutfitSelect ? 0 : undefined,
            onClick: () => onOutfitSelect?.(item),
            onKeyDown: (event) => {
              if ((event.key === "Enter" || event.key === " ") && onOutfitSelect) {
                event.preventDefault()
                onOutfitSelect(item)
              }
            },
          }}
          cardOverrides={{ sizeMode: "fixed" }}
          outfitId={item.id}
          renderedItems={item.renderedItems}
          title={title}
          chips={chips}
          attribution={resolveOutfitAttribution(item.outfit?.created_by)}
          isSaved={isSaved}
          onToggleSave={() => onToggleOutfitSave?.(item.id, !isSaved)}
          onLongPressSave={() => onLongPressOutfitSave?.(item.id)}
          avatarGender={gender}
          cardClassName="w-full"
        />
      )
    }

    const saved = isProductSaved ? isProductSaved(item.id) : false
    const priceLabel = formatPrice(item.price ?? null, item.currency ?? null)
    const isInteractive = Boolean(onProductSelect)
    return (
      <div
        key={`${item.itemType}-${item.id}-${item.createdAt}`}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={isInteractive ? () => onProductSelect?.(item.id) : undefined}
        onKeyDown={
          isInteractive
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onProductSelect?.(item.id)
                }
              }
            : undefined
        }
        className={cn("rounded-xl bg-white p-2", isInteractive && "cursor-pointer")}
      >
        <ProductAlternateCard
          imageSrc={item.imageUrl ?? ""}
          title={item.productName ?? "Product"}
          brand={item.brand ?? "Brand"}
          price={priceLabel}
          isSaved={saved}
          onToggleSave={() => onToggleProductSave?.(item.id, !saved)}
          onLongPressSave={() => onLongPressProductSave?.(item.id)}
          layout="masonry"
        />
      </div>
    )
  }

  return (
    <div className={cn("grid w-full grid-cols-2 gap-2", className)}>
      <div className="flex min-w-0 flex-col gap-2">{leftColumn.map(renderItem)}</div>
      <div className="flex min-w-0 flex-col gap-2">{rightColumn.map(renderItem)}</div>
    </div>
  )
}
