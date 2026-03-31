import { ArrowLeft, X } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { IconButton } from "./icon-button"

export interface ScreenHeaderProps {
  title?: string
  action?: "back" | "close"
  onAction?: () => void
  rightSlot?: ReactNode
  className?: string
  buttonClassName?: string
  titleClassName?: string
}

export function ScreenHeader({
  title,
  action = "back",
  onAction,
  rightSlot,
  className,
  buttonClassName,
  titleClassName,
}: ScreenHeaderProps) {
  const ActionIcon = action === "close" ? X : ArrowLeft
  const ariaLabel = action === "close" ? "Close" : "Back"

  return (
    <div className={cn("flex items-center justify-between gap-2 px-3 pb-2 pt-3", className)}>
      <div className="flex items-center gap-2">
        {onAction ? (
          <IconButton
            tone="ghost"
            size="sm"
            aria-label={ariaLabel}
            onClick={onAction}
            className={cn(
              "h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/70 text-foreground hover:bg-card",
              buttonClassName,
            )}
          >
            <ActionIcon className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        ) : null}
        {title ? (
          <p className={cn("text-sm font-medium text-foreground", titleClassName)}>{title}</p>
        ) : null}
      </div>
      {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
    </div>
  )
}
