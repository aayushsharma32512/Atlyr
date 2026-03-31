import type { CSSProperties } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import type {
  MannequinConfig,
  MannequinSegmentName,
  SegmentDimensions,
  StudioRenderedItem,
  StudioRenderedZone,
  ZoneVisibilityMap,
} from "@/features/studio/types"
import {
  DEFAULT_USER_HEIGHT_CM,
  computeHeadScale,
  getPxPerCm,
  getSegmentLengthPx,
} from "@/features/studio/utils/avatarMath"
import { DEFAULT_VISIBLE_SEGMENTS, MANNEQUIN_SKIN_HEXES } from "@/features/studio/constants"

const BODY_SEGMENTS: MannequinSegmentName[] = ["neck", "torso", "arm_left", "arm_right", "legs", "feet"]

// In-memory cache for SVG assets
const segmentAssetCache = new Map<string, { markup: string; dimensions: SegmentDimensions }>()

// localStorage key for persisting SVG cache across page reloads
const SVG_CACHE_KEY = "landing-mannequin-svg-cache"

// Try to restore cache from localStorage on initial load
try {
  const stored = localStorage.getItem(SVG_CACHE_KEY)
  if (stored) {
    const parsed = JSON.parse(stored) as Record<string, { markup: string; dimensions: SegmentDimensions }>
    Object.entries(parsed).forEach(([key, value]) => {
      segmentAssetCache.set(key, value)
    })
  }
} catch {
  // Ignore localStorage errors (private browsing, etc.)
}

// Helper to save cache to localStorage
function saveCacheToStorage() {
  try {
    const obj: Record<string, { markup: string; dimensions: SegmentDimensions }> = {}
    segmentAssetCache.forEach((value, key) => {
      obj[key] = value
    })
    localStorage.setItem(SVG_CACHE_KEY, JSON.stringify(obj))
  } catch {
    // Ignore localStorage errors
  }
}

type SegmentSvgMap = Record<MannequinSegmentName, string>
type SegmentDimMap = Record<MannequinSegmentName, SegmentDimensions>

interface AvatarRendererProps {
  mannequinConfig: MannequinConfig | null
  items: StudioRenderedItem[]
  containerHeight?: number
  containerWidth?: number
  gender?: "male" | "female"
  skinToneValue?: number
  skinToneHex?: string | null
  visibleSegments?: MannequinSegmentName[]
  zoneAssetOverrides?: ZoneVisibilityMap
  itemOpacity?: number
  blurEnabled?: boolean
  blurAmount?: number
  blurZIndex?: number
  showHead?: boolean
  showBody?: boolean
  onItemSelect?: (item: StudioRenderedItem) => void
  onSegmentSelect?: (segment: MannequinSegmentName) => void
  slotOrder?: StudioRenderedZone[]
  /** Zone that just changed - used for per-item animations */
  animatingZone?: StudioRenderedZone | null
  /** Callback when avatar is fully loaded and ready to display */
  onReady?: (ready: boolean) => void
  /** Ref to the avatar container element for snapshot capture */
  avatarRef?: React.Ref<HTMLDivElement>
}

interface LoadedItemDim {
  width: number
  height: number
}

export function AvatarRenderer({
  mannequinConfig,
  items,
  containerHeight = 460,
  containerWidth = 320,
  gender = "female",
  skinToneValue = 0.35,
  skinToneHex = null,
  visibleSegments,
  zoneAssetOverrides,
  itemOpacity = 1,
  blurEnabled = false,
  blurAmount = 5,
  blurZIndex = 1,
  showHead = true,
  showBody = true,
  onItemSelect,
  onSegmentSelect,
  slotOrder,
  animatingZone,
  onReady,
  avatarRef,
}: AvatarRendererProps) {
  const [segmentMarkup, setSegmentMarkup] = useState<SegmentSvgMap>({} as SegmentSvgMap)
  const [segmentDimensions, setSegmentDimensions] = useState<SegmentDimMap>({} as SegmentDimMap)
  const [assetsReady, setAssetsReady] = useState(false)
  const [itemsReady, setItemsReady] = useState(true)
  const [itemDimensions, setItemDimensions] = useState<Record<string, LoadedItemDim>>({})

  // Load SVG assets + determine dimensions
  useEffect(() => {
    if (!mannequinConfig) {
      setSegmentMarkup({} as SegmentSvgMap)
      setSegmentDimensions({} as SegmentDimMap)
      setAssetsReady(false)
      return
    }
    let cancelled = false
    const segmentEntries = Object.entries(mannequinConfig.segments) as [MannequinSegmentName, typeof mannequinConfig.segments[MannequinSegmentName]][]

    const loaders = segmentEntries.map(async ([name, config]) => {
      const cacheKey = config.assetUrl
      const cached = cacheKey ? segmentAssetCache.get(cacheKey) : undefined
      if (cached) {
        return { name, markup: cached.markup, dimensions: cached.dimensions }
      }
      try {
        const response = await fetch(config.assetUrl)
        const raw = await response.text()
        const sanitized = sanitizeSvgMarkup(raw)
        const dims = extractSvgDimensions(raw)
        if (cacheKey) {
          segmentAssetCache.set(cacheKey, { markup: sanitized, dimensions: dims })
        }
        return { name, markup: sanitized, dimensions: dims }
      } catch {
        return {
          name,
          markup: "",
          dimensions: { width: 100, height: 100 },
        }
      }
    })

    Promise.all(loaders).then((results) => {
      if (cancelled) return
      const markupMap: Partial<SegmentSvgMap> = {}
      const dimMap: Partial<SegmentDimMap> = {}
      results.forEach((entry) => {
        markupMap[entry.name] = entry.markup
        dimMap[entry.name] = entry.dimensions
      })
      setSegmentMarkup(markupMap as SegmentSvgMap)
      setSegmentDimensions(dimMap as SegmentDimMap)
      setAssetsReady(true)
      // Persist cache to localStorage for faster subsequent loads
      saveCacheToStorage()
    })

    return () => {
      cancelled = true
    }
  }, [mannequinConfig])

  // Preload clothing image dimensions
  useEffect(() => {
    if (!items.length) {
      setItemDimensions({})
      setItemsReady(true)
      return
    }
    let cancelled = false
    setItemsReady(false)
    const loaders = items.map(
      (item) =>
        new Promise<{ id: string; dimensions: LoadedItemDim }>((resolve) => {
          const img = new Image()
          img.onload = () =>
            resolve({
              id: item.id,
              dimensions: { width: img.naturalWidth, height: img.naturalHeight },
            })
          img.onerror = () =>
            resolve({
              id: item.id,
              dimensions: { width: 120, height: 120 },
            })
          img.src = item.imageUrl
        }),
    )

    Promise.all(loaders).then((loaded) => {
      if (cancelled) return
      const dims: Record<string, LoadedItemDim> = {}
      loaded.forEach((entry) => {
        dims[entry.id] = entry.dimensions
      })
      setItemDimensions(dims)
      setItemsReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [items])

  const userHeightCm = mannequinConfig?.heightCm ?? DEFAULT_USER_HEIGHT_CM[gender]
  const headDims = segmentDimensions.head ?? { width: 1, height: 1 }

  const { userHeightPx, pxPerCm, headResult } = useMemo(() => {
    let currentUserHeightPx = containerHeight
    let pxPerCmValue = getPxPerCm(currentUserHeightPx, userHeightCm)
    let headMetrics = computeHeadScale(headDims, userHeightCm, pxPerCmValue)

    for (let i = 0; i < 3; i++) {
      const nextUserHeightPx = Math.max(1, containerHeight - headMetrics.chinOffsetPx)
      if (Math.abs(nextUserHeightPx - currentUserHeightPx) < 0.5) {
        currentUserHeightPx = nextUserHeightPx
        pxPerCmValue = getPxPerCm(currentUserHeightPx, userHeightCm)
        headMetrics = computeHeadScale(headDims, userHeightCm, pxPerCmValue)
        break
      }
      currentUserHeightPx = nextUserHeightPx
      pxPerCmValue = getPxPerCm(currentUserHeightPx, userHeightCm)
      headMetrics = computeHeadScale(headDims, userHeightCm, pxPerCmValue)
    }

    return { userHeightPx: currentUserHeightPx, pxPerCm: pxPerCmValue, headResult: headMetrics }
  }, [containerHeight, userHeightCm, headDims])

  const { scaledHead, headScale, chinOffsetPx } = headResult

  const resolvedSegments = useMemo(() => {
    let baseSegments: MannequinSegmentName[]
    if (visibleSegments !== undefined) {
      baseSegments = visibleSegments
    } else if (zoneAssetOverrides) {
      const flattened = Object.values(zoneAssetOverrides)
        .filter((segments): segments is MannequinSegmentName[] => Array.isArray(segments) && segments.length > 0)
        .flat()
      baseSegments = flattened.length ? flattened : DEFAULT_VISIBLE_SEGMENTS
    } else {
      baseSegments = DEFAULT_VISIBLE_SEGMENTS
    }
    const next = new Set<MannequinSegmentName>(baseSegments)
    if (!showHead) {
      next.delete("head")
    }
    if (!showBody) {
      BODY_SEGMENTS.forEach((segment) => next.delete(segment))
    }
    return next
  }, [visibleSegments, zoneAssetOverrides, showHead, showBody])

  const normalizedSkinTone = normalizeHex(skinToneHex)
  const clampedSkinTone = Math.min(1, Math.max(0, skinToneValue))
  const skinBaseLightness = 85 - clampedSkinTone * 40
  const skinSaturation = 35 + clampedSkinTone * 25
  const skinHue = 28
  const fallbackSkinColor = `hsl(${skinHue} ${skinSaturation}% ${skinBaseLightness}%)`
  const fallbackOutlineColor = `hsl(${skinHue} ${skinSaturation}% ${Math.max(20, skinBaseLightness - 25)}%)`
  const skinColor = normalizedSkinTone ?? fallbackSkinColor
  const outlineColor = normalizedSkinTone ? darkenHex(normalizedSkinTone, 0.7) : fallbackOutlineColor

  const clothingLayers = useMemo(() => {
    if (!itemsReady) return []

    const grouped = {
      bottom: [] as StudioRenderedItem[],
      shoes: [] as StudioRenderedItem[],
      top: [] as StudioRenderedItem[],
    }
    items.forEach((item) => {
      if (item.zone === "bottom") grouped.bottom.push(item)
      else if (item.zone === "shoes") grouped.shoes.push(item)
      else grouped.top.push(item)
    })

    const buildLayer = (item: StudioRenderedItem, baseZ: number, index: number) => {
      const dims = itemDimensions[item.id]
      if (!dims || dims.height === 0) return null
      const aspect = dims.width / dims.height
      const targetHeight = pxPerCm * (item.imageLengthCm ?? 0)
      const height = targetHeight > 0 ? targetHeight : dims.height * headScale
      const width = height * aspect
      const top = chinOffsetPx + ((item.placementY ?? 0) / 100) * userHeightPx
      const xOffset = ((item.placementX ?? 0) / 100) * width
      return {
        key: `${item.id}-${index}`,
        item,
        style: {
          position: "absolute" as const,
          left: `calc(50% + ${xOffset}px)`,
          transform: "translateX(-50%)",
          top,
          width,
          height,
          zIndex: baseZ + index,
          objectFit: "contain" as const,
          pointerEvents: "auto" as const,
          opacity: Math.max(0, Math.min(1, itemOpacity)),
        },
      }
    }

    const defaultOrder: StudioRenderedZone[] = ["top", "bottom", "shoes"]
    const resolvedOrder = slotOrder && slotOrder.length > 0 ? slotOrder : defaultOrder
    const maxZ = 4 + Math.max(0, resolvedOrder.length - 1)
    const zMap = new Map<StudioRenderedZone, number>()
    resolvedOrder.forEach((zone, index) => {
      zMap.set(zone, maxZ - index)
    })

    const layers = resolvedOrder
      .flatMap((zone) => {
        const zoneItems = grouped[zone]
        const baseZ = zMap.get(zone) ?? 4
        return zoneItems.map((item, index) => buildLayer(item, baseZ, index))
      })
      .filter(Boolean) as Array<{ key: string; item: StudioRenderedItem; style: CSSProperties }>

    return layers
  }, [items, itemDimensions, pxPerCm, headScale, chinOffsetPx, itemOpacity, userHeightPx, itemsReady, slotOrder])

  const renderSegment = useCallback(
    (name: MannequinSegmentName) => {
      if (!assetsReady || !mannequinConfig) return null
      if (!resolvedSegments.has(name)) return null
      const config = mannequinConfig.segments[name]
      const markup = segmentMarkup[name]
      const baseDimensions = segmentDimensions[name]
      if (!markup || !baseDimensions) return null

      const lengthPx = name === "head" ? scaledHead.height : getSegmentLengthPx(config.lengthPct, userHeightPx)
      const aspect = baseDimensions.width / (baseDimensions.height || 1)
      const widthPx = name === "head" ? scaledHead.width : lengthPx * aspect
      const top = name === "head" ? 0 : chinOffsetPx + (config.placementYPct / 100) * userHeightPx

      let xOffsetPx = 0
      if (name === "arm_left" || name === "arm_right") {
        const torsoConfig = mannequinConfig.segments.torso
        const torsoDims = segmentDimensions.torso ?? { width: 1, height: 1 }
        const torsoLengthPx = getSegmentLengthPx(torsoConfig.lengthPct, userHeightPx)
        const torsoAspect = torsoDims.width / (torsoDims.height || 1)
        const renderedTorsoWidth = torsoLengthPx * torsoAspect
        const offsetPercent = config.xOffsetPct ?? 0
        xOffsetPx = offsetPercent * renderedTorsoWidth
      }

      const styledMarkup = markup
        .replace(/var\(--mannequin-skin\)/g, skinColor)
        .replace(/var\(--mannequin-outline\)/g, outlineColor)
      
      const isInteractive = Boolean(onSegmentSelect)

      return (
        <div
          key={name}
          aria-label={`${name} segment`}
          className={cn(
             "absolute select-none",
             isInteractive && "cursor-pointer"
          )}
          style={{
            left: "50%",
            top,
            width: widthPx,
            height: lengthPx,
            transform: `translateX(calc(-50% + ${xOffsetPx}px))`,
            zIndex: config.zIndex,
            pointerEvents: isInteractive ? "auto" : "none",
          }}
          dangerouslySetInnerHTML={{ __html: styledMarkup }}
          onClick={(e) => {
            if (isInteractive) {
                e.stopPropagation()
                onSegmentSelect?.(name)
            }
          }}
        />
      )
    },
    [
      assetsReady,
      mannequinConfig,
      resolvedSegments,
      segmentMarkup,
      segmentDimensions,
      scaledHead.height,
      scaledHead.width,
      userHeightPx,
      chinOffsetPx,
      skinColor,
      outlineColor,
      onSegmentSelect,
    ],
  )

  const showLoading = !assetsReady || !itemsReady
  
  // Notify parent when ready state changes
  useEffect(() => {
    onReady?.(!showLoading)
  }, [showLoading, onReady])

  return (
    <div ref={avatarRef} data-snapshot="true" className={cn("relative bg-transparent", "overflow-hidden")} style={{ height: containerHeight, width: containerWidth }}>
      {showLoading ? (
        <div className="h-full w-full animate-pulse rounded-xl bg-muted/30" aria-label="Loading preview" />
      ) : (
        <div>
          <style>{`
            @keyframes itemFadeIn {
              from { opacity: 0.4; }
              to { opacity: 1; }
            }
          `}</style>
          {Array.from(resolvedSegments).map((segment) => renderSegment(segment))}
          {clothingLayers.map((layer) => {
            const shouldAnimate = animatingZone && layer.item.zone === animatingZone
            return (
              <img
                key={shouldAnimate ? `${layer.key}-anim` : layer.key}
                src={layer.item.imageUrl}
                alt={layer.item.description ?? layer.item.productName ?? layer.item.brand ?? "Outfit item"}
                className="absolute select-none"
                style={{
                  ...layer.style,
                  animation: shouldAnimate ? 'itemFadeIn 250ms ease-out' : undefined,
                }}
                onClick={() => onItemSelect?.(layer.item)}
              />
            )
          })}
        </div>
      )}
      {blurEnabled ? (
        <div
          className="pointer-events-none"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: blurZIndex,
            backdropFilter: `blur(${blurAmount}px)`,
            WebkitBackdropFilter: `blur(${blurAmount}px)`,
          }}
        />
      ) : null}
    </div>
  )
}

function sanitizeSvgMarkup(raw: string): string {
  let result = raw
  result = result.replace(/<rect[^>]*fill="#ffffff"[^>]*>/gi, "")
  result = result.replace(/fill="#[0-9a-fA-F]{3,6}"/gi, (match) => {
    const hex = match.toLowerCase().match(/#[0-9a-f]{3,6}/)?.[0]
    if (hex && MANNEQUIN_SKIN_HEXES.has(hex)) {
      return 'fill="var(--mannequin-skin)"'
    }
    return match
  })
  result = result.replace(/stroke="#000000"/gi, 'stroke="var(--mannequin-outline)"')
  result = result.replace(/width="[^"]*"/i, 'width="100%"')
  result = result.replace(/height="[^"]*"/i, 'height="100%"')
  if (!/preserveAspectRatio/i.test(result)) {
    result = result.replace(/<svg/i, '<svg preserveAspectRatio="xMidYMid meet"')
  }
  return result
}

function extractSvgDimensions(markup: string): SegmentDimensions {
  const viewBoxMatch = markup.match(/viewBox="([^"]+)"/i)
  if (viewBoxMatch) {
    const [, values] = viewBoxMatch
    const parts = values.split(/\s+/).map(Number)
    if (parts.length === 4) {
      const width = parts[2]
      const height = parts[3]
      if (Number.isFinite(width) && Number.isFinite(height)) {
        return { width, height }
      }
    }
  }
  const widthMatch = markup.match(/width="([^"]+)"/i)
  const heightMatch = markup.match(/height="([^"]+)"/i)
  const width = widthMatch ? Number(widthMatch[1].replace(/[^0-9.]/g, "")) : 100
  const height = heightMatch ? Number(heightMatch[1].replace(/[^0-9.]/g, "")) : 100
  return {
    width: Number.isFinite(width) && width > 0 ? width : 100,
    height: Number.isFinite(height) && height > 0 ? height : 100,
  }
}

function normalizeHex(value: string | null | undefined) {
  if (!value) {
    return null
  }
  let hex = value.trim().toLowerCase()
  if (!hex) {
    return null
  }
  if (!hex.startsWith("#")) {
    hex = `#${hex}`
  }
  if (hex.length === 4) {
    const [r, g, b] = hex.slice(1).split("")
    hex = `#${r}${r}${g}${g}${b}${b}`
  }
  if (!/^#[0-9a-f]{6}$/.test(hex)) {
    return null
  }
  return hex
}

function darkenHex(hex: string, factor: number) {
  const normalized = normalizeHex(hex)
  if (!normalized) {
    return hex
  }
  const r = Math.round(parseInt(normalized.slice(1, 3), 16) * factor)
  const g = Math.round(parseInt(normalized.slice(3, 5), 16) * factor)
  const b = Math.round(parseInt(normalized.slice(5, 7), 16) * factor)
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`
}

/**
 * Preload and cache mannequin segment SVGs for a given config.
 * Call this BEFORE AvatarRenderer mounts to eliminate loading state.
 * The segments will be stored in cache and reused when AvatarRenderer mounts.
 */
export async function preloadMannequinSegments(mannequinConfig: MannequinConfig | null): Promise<void> {
  if (!mannequinConfig) return
  
  const segmentEntries = Object.entries(mannequinConfig.segments) as [MannequinSegmentName, typeof mannequinConfig.segments[MannequinSegmentName]][]
  
  await Promise.all(
    segmentEntries.map(async ([, config]) => {
      const cacheKey = config.assetUrl
      // Skip if already in memory cache
      if (cacheKey && segmentAssetCache.has(cacheKey)) {
        return
      }
      try {
        const response = await fetch(config.assetUrl)
        const raw = await response.text()
        const sanitized = sanitizeSvgMarkup(raw)
        const dims = extractSvgDimensions(raw)
        if (cacheKey) {
          segmentAssetCache.set(cacheKey, { markup: sanitized, dimensions: dims })
        }
      } catch {
        // Silently fail - AvatarRenderer will handle missing segments
      }
    })
  )
  // Persist to localStorage for next visit
  saveCacheToStorage()
}

export default AvatarRenderer
