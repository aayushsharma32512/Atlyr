import { cn } from "@/lib/utils"

import { IconButton } from "./icon-button"

import { GitCompare, Redo2, Undo2 } from "lucide-react"

export interface RightActionRailProps {
  className?: string
  canRedo?: boolean
  canUndo?: boolean
  isCheckpointActive?: boolean
  onCheckpoint?: () => void
  onRedo?: () => void
  onUndo?: () => void
  variant?: "default" | "compact"
}

const VARIANT_CLASSES: Record<Required<RightActionRailProps>["variant"], string> = {
  default: "flex flex-col items-center gap-10 rounded-2xl bg-card px-3 py-6",
  compact:
    "flex h-48 w-12 flex-col items-center justify-end gap-10 rounded-lg bg-card px-2.5 py-6",
}

export function RightActionRail({
  className,
  canRedo = true,
  canUndo = true,
  isCheckpointActive = false,
  onCheckpoint,
  onRedo,
  onUndo,
  variant = "default",
}: RightActionRailProps) {
  const redoDisabled = !onRedo || !canRedo
  const undoDisabled = !onUndo || !canUndo
  const checkpointDisabled = !onCheckpoint

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
        aria-label="Redo"
        onClick={onRedo}
        disabled={redoDisabled}
        className="text-foreground"
      >
        <Redo2 aria-hidden="true" />
      </IconButton>
      <IconButton
        tone="ghost"
        size="sm"
        aria-label="Undo"
        onClick={onUndo}
        disabled={undoDisabled}
        className="text-foreground"
      >
        <Undo2 aria-hidden="true" />
      </IconButton>
      <IconButton
        tone={isCheckpointActive ? "outline" : "ghost"}
        size="sm"
        aria-label="Checkpoint"
        aria-pressed={isCheckpointActive}
        onClick={onCheckpoint}
        disabled={checkpointDisabled}
        className={cn(
          "text-foreground",
          isCheckpointActive ? "border border-primary/40 bg-primary/10 text-primary" : null,
        )}
      >
        <GitCompare aria-hidden="true" />
      </IconButton>
    </div>
  )
}
