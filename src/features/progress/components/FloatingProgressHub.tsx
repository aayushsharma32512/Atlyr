import { useState, useEffect, useRef, useCallback } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Loader2, CheckCircle2, X, Layers, UserRound, Sparkles } from "lucide-react"
import { SparklesIcon } from "@/features/progress/components/Icons/sparkles"
import { UserCogIcon } from "@/features/progress/components/Icons/userCog"
import { useJobs } from "../providers/JobsContext"
import type { Job } from "../providers/JobsContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { openLikenessDrawer } from "@/features/likeness/openLikenessDrawer"

export function FloatingProgressHub() {
  const { jobs, processingCount, readyCount, removeJob } = useJobs()
  const [isExpanded, setIsExpanded] = useState(false)
  const [yPosition, setYPosition] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight / 2 - 36 : 0
  ) // Y position in pixels
  const [isDragging, setIsDragging] = useState(false)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartYRef = useRef(0)
  const pointerStartYRef = useRef(0)
  const dragDistanceRef = useRef(0)
  const isDraggingRef = useRef(false)
  const lastExpandTimeRef = useRef(0)
  const activeDragHandlers = useRef<{
    move?: (event: PointerEvent) => void
    up?: (event: PointerEvent) => void
  }>({})

  // Split and sort jobs: active first (newest), then completed (newest)
  const activeJobs = jobs
    .filter(j => j.status === 'processing')
    .sort((a, b) => b.startedAt - a.startedAt)

  const readyJobs = jobs
    .filter(j => j.status === 'ready')
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 4)

  const renderActiveIcon = (job: (typeof jobs)[0]) => {
    const isAvatar = job.type === "likeness"
    const glowClass = isAvatar
      ? "bg-primary border-primary/70"
      : "bg-primary border-primary/70"

    return (
      <motion.div
        className={`relative h-7 w-7 rounded-full border ${
          isAvatar ? "" : "bg-gradient-to-br"
        } ${glowClass} overflow-hidden flex items-center justify-center`}
        transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
        title={isAvatar ? "Avatar generating" : "Try-On generating"}
      >
        {isAvatar ? (
          <UserCogIcon className="text-primary-foreground" size={14} />
        ) : (
          <SparklesIcon className="text-white drop-shadow-sm" size={14} />
        )}
        <span className="absolute inset-0 rounded-full bg-white/10 animate-ping" />
      </motion.div>
    )
  }

  const renderReadyIcon = (job: (typeof jobs)[0]) => {
    const isAvatar = job.type === "likeness"
    const glowClass = isAvatar
      ? "bg-primary border-primary/70"
      : "bg-primary border-primary/70"

    return (
      <motion.div
        className={`relative h-7 w-7 rounded-full border bg-gradient-to-br ${glowClass} overflow-hidden flex items-center justify-center`}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        title={isAvatar ? "Avatar ready" : "Try-On ready"}
      >
        {isAvatar ? (
          <UserRound className="h-3.5 w-3.5 text-white drop-shadow-sm" />
        ) : (
          <Sparkles className="text-white drop-shadow-sm" size={14} />
        )}
        <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-white/90 mix-blend-screen" />
      </motion.div>
    )
  }

  const completedJobs = jobs
    .filter(j => j.status === 'ready' || j.status === 'failed')
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 5)

  // Group jobs by status and type for visual stacking
  const groupJobsByStatusAndType = (list: Job[]) => {
    const map = new Map<string, Job[]>()
    list.forEach((job) => {
      const key = `${job.status}-${job.type}`
      const group = map.get(key) ?? []
      group.push(job)
      map.set(key, group)
    })
    // Sort each group by newest first, then return groups in order
    return Array.from(map.values()).map(group => 
      group.sort((a, b) => b.startedAt - a.startedAt)
    )
  }

  const groupedActive = groupJobsByStatusAndType(activeJobs)
  const groupedCompleted = groupJobsByStatusAndType(completedJobs)

  // Click outside to collapse
  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded])

  // Handle window resize - keep position within bounds
  useEffect(() => {
    const handleResize = () => {
      const nextMinY = VIEW_PADDING
      const nextMaxY = Math.max(VIEW_PADDING, window.innerHeight - PILL_HEIGHT - VIEW_PADDING)
      setYPosition((prev) => Math.min(nextMaxY, Math.max(nextMinY, prev)))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleViewResult = (job: (typeof jobs)[0]) => {
    if (job.type === "likeness" && job.metadata?.batchId) {
      const outfitParams = job.metadata.outfitParams as Record<string, string | null> | undefined
      const outfitItems = outfitParams
        ? {
            topId: outfitParams.topId ?? null,
            bottomId: outfitParams.bottomId ?? null,
            footwearId: outfitParams.footwearId ?? null,
          }
        : undefined
      const resolvedGender =
        outfitParams?.outfitGender === "male" ||
        outfitParams?.outfitGender === "female" ||
        outfitParams?.outfitGender === "unisex"
          ? (outfitParams.outfitGender as "male" | "female" | "unisex")
          : null
      const outfitSnapshot = outfitParams
        ? {
            id: outfitParams.outfitId ?? undefined,
            name: outfitParams.outfitName ?? null,
            category: outfitParams.outfitCategory ?? null,
            occasionId: outfitParams.outfitOccasion ?? null,
            backgroundId: outfitParams.outfitBackgroundId ?? null,
            gender: resolvedGender,
          }
        : undefined

      if (job.metadata?.saved) {
        openLikenessDrawer({
          initialStep: 3,
          batchId: job.metadata.batchId,
          outfitItems,
          outfitSnapshot,
          entrySource: "fromProgressHub",
          savedMode: true,
          savedPoseId: job.metadata?.savedPoseId ?? null,
        })
      } else {
        openLikenessDrawer({
          initialStep: 2,
          batchId: job.metadata.batchId,
          outfitItems,
          outfitSnapshot,
          entrySource: "fromProgressHub",
        })
      }
    } else if (job.type === "tryon") {
      navigate("/home?moodboard=try-ons")
    }
    setIsExpanded(false)
  }

  // Constants
  const PILL_HEIGHT = 46
  const EXPANDED_HEIGHT = 420
  const VIEW_PADDING = 12
  
  // Calculate bounds
  const minY = VIEW_PADDING
  const maxY = Math.max(VIEW_PADDING, window.innerHeight - PILL_HEIGHT - VIEW_PADDING)
  
  // Clamp current position
  const clampedY = Math.min(maxY, Math.max(minY, yPosition))
  const clampToViewport = useCallback(
    (value: number) => Math.min(maxY, Math.max(minY, value)),
    [maxY, minY]
  )
  
  // Decide expansion direction without moving the pill itself
  const expandUpward = (() => {
    const spaceAbove = clampedY - VIEW_PADDING
    const spaceBelow = (window.innerHeight - VIEW_PADDING) - (clampedY + PILL_HEIGHT)
    // If we're close to the bottom (not enough room below), expand upward
    return spaceBelow < EXPANDED_HEIGHT - PILL_HEIGHT && spaceAbove > spaceBelow
  })()
  const panelOffset = expandUpward ? -(EXPANDED_HEIGHT - PILL_HEIGHT) : 0

  const cleanupDragListeners = () => {
    const { move, up } = activeDragHandlers.current
    if (move) {
      window.removeEventListener("pointermove", move)
    }
    if (up) {
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
    }
    activeDragHandlers.current = {}
  }

  // Pointer-based drag for crisp, momentum-free movement
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isExpanded) return
    event.preventDefault()
    cleanupDragListeners()

    dragStartYRef.current = yPosition
    pointerStartYRef.current = event.clientY
    dragDistanceRef.current = 0
    isDraggingRef.current = true
    setIsDragging(true)

    const handleMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return
      const delta = moveEvent.clientY - pointerStartYRef.current
      dragDistanceRef.current = Math.abs(delta)
      setYPosition(clampToViewport(dragStartYRef.current + delta))
    }

    const handleUp = () => {
      if (!isDraggingRef.current) return
      const travelled = dragDistanceRef.current
      isDraggingRef.current = false
      setIsDragging(false)
      cleanupDragListeners()
      // Treat a tiny move as a tap to toggle expansion
      if (travelled < 6) {
        setIsExpanded((v) => {
          const next = !v
          if (next) {
            lastExpandTimeRef.current = Date.now()
          }
          return next
        })
      }
    }

    activeDragHandlers.current = { move: handleMove, up: handleUp }
    window.addEventListener("pointermove", handleMove, { passive: true })
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleUp)
  }

  useEffect(() => {
    return () => {
      cleanupDragListeners()
      isDraggingRef.current = false
    }
  }, [])

  const collapsedBadge =
    processingCount > 0 ? (
      <div className="flex flex-col items-center justify-center gap-1">
        <Loader2 className="h-4 w-4 text-primary dark:text-primary animate-spin" />
      </div>
    ) : readyCount > 0 ? (
      <div className="flex flex-col items-center justify-center gap-1">
        <Layers className="h-4 w-4 text-primary dark:text-primary" />
      </div>
    ) : (
      <Layers className="h-4 w-4 text-primary dark:text-primary/90" />
    )

  return (
    <motion.div
      ref={containerRef}
      className="fixed left-3 md:left-4 z-50 will-change-transform"
      initial={{ x: -120, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      style={{ top: clampedY }}
    >
      <motion.div
        onPointerDown={handlePointerDown}
        className="group relative overflow-visible bg-background backdrop-blur-md shadow-lg shadow-black/10 dark:shadow-black/40 border border-gray-200/80 dark:border-gray-700/80 cursor-pointer will-change-transform"
        style={{
          borderRadius: isExpanded ? 16 : 14,
          touchAction: "none",
          userSelect: isDragging ? "none" : undefined,
        }}
        animate={{
          width: isExpanded ? 280 : 48,
          height: PILL_HEIGHT,
          maxHeight: isExpanded ? EXPANDED_HEIGHT : PILL_HEIGHT,
          borderRadius: isExpanded ? 16 : 14,
          x: isExpanded ? 8 : 0,
          scale: isExpanded ? 1.015 : 1,
        }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        data-dragging={isDragging}
        aria-label="Progress Hub"
        role="button"
        tabIndex={0}
      >
        {/* Collapsed summary strip */}
        {!isExpanded && (
          <div className="absolute inset-y-0 left-0 flex w-12 flex-col items-center justify-center gap-1">
            {!isExpanded && collapsedBadge}
          </div>
        )}

        {/* Badge indicators */}
        {processingCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse"
          />
        )}
        {readyCount > 0 && processingCount === 0 && (
          !isExpanded && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full"
            />
          )
        )}

        {/* Expanded content */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="panel"
              initial={{
                opacity: 1,
                scaleY: 0.3,
                y: expandUpward ? 8 : -8,
              }}
              animate={{ opacity: 1, scaleY: 1, y: 0 }}
              exit={{
                opacity: 0,
                scaleY: 0.35,
                y: expandUpward ? 8 : -8,
              }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="h-full flex flex-col bg-background rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/40 border border-gray-200/80 dark:border-gray-800/80 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: panelOffset,
                left: 0,
                width: "100%",
                height: "auto",
                maxHeight: EXPANDED_HEIGHT,
                pointerEvents: "auto",
                transformOrigin: expandUpward ? "bottom center" : "top center",
              }}
            >
              <div className="flex items-center justify-between px-3 pt-3 pb-2 border-none border-gray-200/80 dark:border-gray-800/80">
                <div className="flex items-center gap-3">
                  {/* Active stack */}
                  {activeJobs.slice(0, 4).map((job) => (
                    <div key={job.id}>{renderActiveIcon(job)}</div>
                  ))}
                    {activeJobs.length > 4 && (
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      +{activeJobs.length - 4}
                    </span>
                  )}
                  {/* Completed stack */}
                  {readyJobs.map((job) => (
                    <div key={job.id}>{renderReadyIcon(job)}</div>
                  ))}
                    {jobs.filter(j => j.status === 'ready').length > 4 && (
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      +{jobs.filter(j => j.status === 'ready').length - 4}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-2">
                {jobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-1">
                    <Layers className="h-10 w-10 text-gray-300 dark:text-gray-700" />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No active generations</p>
                    <p className="text-xs text-muted-foreground">Start a Try-On in Studio!</p>
                  </div>
                ) : (
                  <>
                    {activeJobs.length > 0 && (
                      <>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                          Active ({activeJobs.length})
                        </div>
                        {groupedActive.map((group, groupIndex) => (
                          <div key={`active-group-${groupIndex}`} className="space-y-0">
                            {group.map((job, jobIndex) => (
                              <JobCard
                                key={job.id}
                                job={job}
                                removeJob={removeJob}
                                handleViewResult={handleViewResult}
                              shouldBlockClick={() => Date.now() - lastExpandTimeRef.current < 220}
                                isFirstInGroup={jobIndex === 0}
                                isLastInGroup={jobIndex === group.length - 1}
                                isOnlyInGroup={group.length === 1}
                              />
                            ))}
                          </div>
                        ))}
                      </>
                    )}

                    {completedJobs.length > 0 && (
                      <>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5 mt-3">
                          Recent ({completedJobs.length})
                        </div>
                        {groupedCompleted.map((group, groupIndex) => (
                          <div key={`completed-group-${groupIndex}`} className="space-y-0">
                            {group.map((job, jobIndex) => (
                              <JobCard
                                key={job.id}
                                job={job}
                                removeJob={removeJob}
                                handleViewResult={handleViewResult}
                              shouldBlockClick={() => Date.now() - lastExpandTimeRef.current < 220}
                                isFirstInGroup={jobIndex === 0}
                                isLastInGroup={jobIndex === group.length - 1}
                                isOnlyInGroup={group.length === 1}
                                />
                            ))}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// JobCard component for rendering individual job items
function JobCard({
  job,
  removeJob,
  handleViewResult,
  shouldBlockClick,
  isFirstInGroup = false,
  isLastInGroup = false,
  isOnlyInGroup = false
}: {
  job: Job
  removeJob: (id: string) => void
  handleViewResult: (job: Job) => void
  shouldBlockClick: () => boolean
  isFirstInGroup?: boolean
  isLastInGroup?: boolean
  isOnlyInGroup?: boolean
}) {
  const isProcessing = job.status === "processing"
  console.log("isOnlyInGroup", isOnlyInGroup, job.id)
  return (
    <div 
      className={`flex items-start gap-3 p-2.5 bg-gray-50/50 dark:bg-gray-900/30 ${
        isOnlyInGroup 
          ? "border border-gray-200 rounded-md dark:border-gray-800"
          : isFirstInGroup
            ? "border border-b-0 border-gray-200 rounded-t-md dark:border-gray-800"
            : isLastInGroup
              ? "border border-gray-200 rounded-b-md dark:border-gray-800"
              : "border border-gray-200 rounded-none border-b-0 dark:border-gray-800"
      } ${job.status === "ready" ? "cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/50 transition-colors" : ""}`}
      onClick={() => {
        if (job.status === "ready" && !shouldBlockClick()) {
          handleViewResult(job)
        }
      }}
    >
      {/* Thumbnail on the left - bigger */}
      {!(job.status === "processing" && !job.thumbnail) && (
        <div className="relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
          {job.thumbnail ? (
            <img
              src={job.thumbnail}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error("[FloatingProgressHub] Image load error:", {
                  jobId: job.id,
                  thumbnail: job.thumbnail,
                  error: e
                })
              }}
            />
          ) : job.status === "ready" ? (
            <div className="w-full h-full flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <X className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          )}
        </div>
      )}

      {/* Content on the right */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Job Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Badge
                variant={
                  job.status === "processing"
                    ? "default"
                    : job.status === "ready"
                      ? "secondary"
                      : "destructive"
                }
                className="text-[10px] px-1.5 py-0.5"
              >
                {job.type === "likeness" ? "Avatar" : "Try-On"}
              </Badge>
              {job.status === "processing" && (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              )}
              {job.status === "ready" && (
                <CheckCircle2 className="h-3 w-3 text-primary" />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatDistanceToNow(job.startedAt, { addSuffix: true })}
            </p>
          </div>
          {!isProcessing && (
             <button
             onClick={(e) => {
              e.stopPropagation()
              removeJob(job.id)
            }}
             className="h-3 w-3 inline-flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
             aria-label="Close"
           >
             <X className="h-3 w-3" />
           </button>
          )}
        </div>

        {/* Real Progress Bar */}
        {job.status === "processing" && (
          <div className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
              animate={{ width: `${job.progress ?? 0}%` }}
              transition={{
                duration: 0.5,
                ease: "easeOut",
              }}
            />
          </div>
        )}

        {job.status === "failed" && (
          <p className="text-[10px] text-red-600 dark:text-red-400">
            Generation failed. Please try again.
          </p>
        )}
      </div>
    </div>
  )
}
