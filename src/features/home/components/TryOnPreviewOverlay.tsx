import { useEffect, useRef, type MouseEvent, type TouchEvent } from "react"
import { ArrowUpRight, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { IconButton } from "@/design-system/primitives"
import type { TryOn } from "@/services/collections/collectionsService"

type TryOnPreviewOverlayProps = {
  items: TryOn[]
  activeIndex: number
  onClose: () => void
  onIndexChange: (nextIndex: number) => void
  onOpenStudio: (item: TryOn) => void
}

export function TryOnPreviewOverlay({
  items,
  activeIndex,
  onClose,
  onIndexChange,
  onOpenStudio,
}: TryOnPreviewOverlayProps) {
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const lockAppliedRef = useRef<boolean>(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mouseStartRef = useRef<number | null>(null)
  const isDraggingRef = useRef<boolean>(false)

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const maxIndex = Math.max(0, items.length - 1)
  const activeItem = items[activeIndex]

  const stepIndex = (delta: number) => {
    if (items.length <= 1) return
    const nextIndex = Math.min(maxIndex, Math.max(0, activeIndex + delta))
    if (nextIndex !== activeIndex) {
      onIndexChange(nextIndex)
    }
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() }
    lockAppliedRef.current = false
    if (containerRef.current) {
      containerRef.current.style.touchAction = "pan-y"
    }
  }

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current
    if (!start) return
    const touch = event.touches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (!lockAppliedRef.current && Math.abs(dx) > Math.abs(dy) * 2.5) {
      if (containerRef.current) {
        containerRef.current.style.touchAction = "none"
      }
      lockAppliedRef.current = true
    }
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (containerRef.current) {
      containerRef.current.style.touchAction = "pan-y"
    }
    lockAppliedRef.current = false
    if (!start) return

    // Avoid colliding with the OS back gesture.
    if (start.x <= 16) return

    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    const dt = Date.now() - start.t
    const velocity = Math.abs(dx) / Math.max(1, dt)
    const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI)
    const horizontalEnough = angle <= 20
    const distanceCommit = Math.abs(dx) > 50
    const velocityCommit = velocity >= 0.6

    if (horizontalEnough && (distanceCommit || velocityCommit)) {
      if (dx < 0) {
        stepIndex(1)
      } else {
        stepIndex(-1)
      }
    }
  }

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true
    mouseStartRef.current = event.clientX
  }

  const handleMouseUp = (event: MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || mouseStartRef.current === null) return
    const diff = event.clientX - mouseStartRef.current
    const threshold = 50
    if (Math.abs(diff) > threshold) {
      if (diff < 0) {
        stepIndex(1)
      } else {
        stepIndex(-1)
      }
    }
    isDraggingRef.current = false
    mouseStartRef.current = null
  }

  if (!activeItem) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[150] bg-background"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          isDraggingRef.current = false
          mouseStartRef.current = null
        }}
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="flex h-full w-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {items.map((item, index) => (
            <div key={item.id} className="h-full w-full flex-shrink-0">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt="Try-on preview"
                  className="h-full w-full object-contain"
                  loading={index === activeIndex ? "eager" : "lazy"}
                  draggable={false}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                  Preview unavailable
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="relative flex items-center justify-center">
          <IconButton
            tone="inverse"
            size="sm"
            className="pointer-events-auto absolute left-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X />
          </IconButton>
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-background/85 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur">
            <span className="text-sm font-semibold">Looks</span>
            <span className="rounded-full bg-foreground/90 px-2 py-0.5 text-[10px] text-background">
              {activeIndex + 1}/{items.length}
            </span>
          </div>
        </div>
      </div>

      {activeItem.outfitId ? (
        <div className="pointer-events-none absolute bottom-0 right-0 z-10 pb-[calc(env(safe-area-inset-bottom)+16px)] pr-4">
          <Button
            variant="secondary"
            className="pointer-events-auto h-10 rounded-full border border-border/70 bg-background/90 px-4 text-sm font-semibold shadow-sm backdrop-blur"
            onClick={() => onOpenStudio(activeItem)}
          >
            Studio
            <ArrowUpRight className="ml-1 size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
