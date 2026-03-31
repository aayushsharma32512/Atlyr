import { useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { OutfitInspirationTile } from "@/design-system/primitives"
import type { MoodboardPreview } from "@/services/collections/collectionsService"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface MoodboardCardProps {
  name: string
  slug?: string
  isSystem?: boolean
  itemCount?: number
  preview?: MoodboardPreview
}

const MoodboardCard = ({ name, slug, isSystem = false, itemCount = 0, preview }: MoodboardCardProps) => {
  const navigate = useNavigate()
  const items = useMemo(() => preview?.items ?? [], [preview?.items])
  const hasItems = items.length > 0
  const resolveGender = (value?: string | null): "male" | "female" => (value === "male" ? "male" : "female")
  const isClickable = Boolean(slug) && itemCount > 0

  const renderPreviewItem = useCallback(
    (item: NonNullable<typeof items>[number]) => {
      if (item.itemType === "outfit") {
        return (
          <OutfitInspirationTile
            preset="compact"
            wrapperClassName="border-0 p-0 rounded-none h-full w-full"
            cardOverrides={{ showSaveButton: false }}
            outfitId={item.id}
            renderedItems={item.renderedItems}
            showTitle={true}
            showChips={true}
            // sizeMode="fixed"
            // fluidLayout="avatar"  aspectRatio="3 / 4"
            cardClassName="h-full w-full"
            avatarGender={resolveGender(item.gender)}
          />
        )
      }

      return item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.productName ?? "Product preview"}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Preview unavailable</div>
      )
    },
    [resolveGender],
  )

  const handleNavigate = useCallback(() => {
    if (!slug) return
    const params = new URLSearchParams({ moodboard: slug })
    navigate(`/home?${params.toString()}`)
  }, [navigate, slug])

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-disabled={isClickable ? undefined : true}
      onClick={isClickable ? handleNavigate : undefined}
      onKeyDown={
        isClickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                handleNavigate()
              }
            }
          : undefined
      }
      className={cn(
        "w-full overflow-hidden rounded-2xl bg-card text-left shadow-none transition hover:shadow-sm border border-sidebar-border border-b-1",
        !isClickable && "cursor-default",
      )}
    >
      <div className="grid aspect-[7/9] grid-cols-2 grid-rows-2 gap-0 overflow-hidden rounded-t-2xl bg-none border border-sidebar-border border-b-1 border-x-0 border-t-0">
        {hasItems ? (
          items.length === 1 ? (
            // 1 item: Full space
            <div className="relative col-span-2 row-span-2 overflow-hidden bg-card p-2">
              {items[0] ? renderPreviewItem(items[0]) : null}
            </div>
          ) : items.length === 2 ? (
            // 2 items: Half and half
            <>
              <div className="relative row-span-2 overflow-hidden bg-card p-2  border-r border-sidebar-border">
                {items[0] ? renderPreviewItem(items[0]) : null}
              </div>
              <div className="relative row-span-2 overflow-hidden bg-card p-2">
                {items[1] ? renderPreviewItem(items[1]) : null}
              </div>
            </>
          ) : (
            // 3+ items: 1 large left + 2 stacked right
            <>
              <div className="relative row-span-2 overflow-hidden bg-card p-1 border-r border-sidebar-border">
                {items[0] ? renderPreviewItem(items[0]) : null}
              </div>
              <div className="relative overflow-hidden bg-card p-1">
                {items[1] ? renderPreviewItem(items[1]) : null}
              </div>
              <div className="relative overflow-hidden bg-card p-1 border-t border-sidebar-border">
                {items[2] ? renderPreviewItem(items[2]) : null}
              </div>
            </>
          )
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate("/search")
            }}
            className="col-span-2 row-span-2 flex flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40">
              <span className="text-xl font-light">+</span>
            </div>
            <span className="text-xs">Add items</span>
          </button>
        )}
      </div>
      <div className="p-3 text-left">
        <p className="text-sm font-medium text-gray-900">{name}</p>
        {/* <p className="text-xs text-muted-foreground">{isSystem ? "System" : "Moodboard"}</p> */}
      </div>
    </div>
  )
}

export default MoodboardCard
