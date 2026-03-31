import { TrayActionButton } from "@/design-system/primitives"
import { cn } from "@/lib/utils"
import type { TryOn } from "@/services/collections/collectionsService"
import { ArrowUpRight } from "lucide-react"

type TryOnGridProps = {
  items: TryOn[]
  onSelect: (item: TryOn, index: number) => void
  onOpenStudio: (item: TryOn) => void
  overlay?: boolean
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
})

export function TryOnGrid({ items, onSelect, onOpenStudio, overlay = true }: TryOnGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/10 text-sm text-muted-foreground">
        No try-ons yet
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, index) => {
        const label = dateFormatter.format(new Date(item.createdAt))
        return (
          <div
            key={item.id}
            className={cn(
              "group relative aspect-[3/4] overflow-hidden rounded-2xl border border-muted-foreground/10 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md",
              item.imageUrl ? "text-foreground" : "text-muted-foreground",
            )}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(item, index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onSelect(item, index)
              }
            }}
          >
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="Try-on preview" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs">Preview unavailable</div>
            )}
            <div className="absolute bottom-1 left-1 px-2 py-1 font-medium text-foreground text-nowrap text-xs2">
              {label}
            </div>
            {item.outfitId ? (
              <div className="absolute bottom-1 right-1">
              <TrayActionButton
                tone="plain"
                iconEnd={ArrowUpRight}
                label="Studio"
                className="pointer-events-auto h-8 rounded-xl bg-transparent px-3 text-xs font-medium text-foreground hover:bg-background"
                  onClick={() => onOpenStudio(item)}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
