import { cn } from "@/lib/utils"

import { IconButton } from "./icon-button"

import { Info, Share, Shuffle } from "lucide-react"

export interface LeftActionRailProps {
  className?: string
  onInfo?: () => void
  onRemix?: () => void
  remixDisabled?: boolean
  onShare?: () => void
  variant?: "default" | "compact"
}

const VARIANT_CLASSES: Record<Required<LeftActionRailProps>["variant"], string> = {
  default: "flex flex-col items-center gap-10 rounded-2xl bg-card px-3 py-6",
  compact:
    "flex h-48 w-12 flex-col items-center justify-end gap-10 rounded-lg bg-card px-2.5 py-6",
}

export function LeftActionRail({
  className,
  onInfo,
  onRemix,
  remixDisabled,
  onShare,
  variant = "default",
}: LeftActionRailProps) {
  const remixIsDisabled = !onRemix || Boolean(remixDisabled)
  const shareIsDisabled = !onShare

  return (
    <div
      className={cn(
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      <IconButton
        tone="ghost"
        size="sm"
        aria-label="Information"
        onClick={onInfo}
        className="text-foreground"
      >
        <Info aria-hidden="true" />
      </IconButton>
      <IconButton
        tone="ghost"
        size="sm"
        aria-label="Remix"
        onClick={onRemix}
        disabled={remixIsDisabled}
        className="text-foreground"
      >
        <Shuffle className="stroke-width-[1px] text-foreground stroke-current" />
      </IconButton>
      <IconButton
        tone="ghost"
        size="sm"
        aria-label="Share"
        onClick={onShare}
        disabled={shareIsDisabled}
        className="text-foreground"
      >
        <Share aria-hidden="true" />
      </IconButton>
    </div>
  )
}
