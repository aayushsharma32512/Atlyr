import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { usePostHog } from "posthog-js/react"

import { shouldDisablePostHogForLocation } from "@/integrations/posthog/posthogRoutePolicy"

type Props = {
  enableSessionReplay: boolean
}

export function PostHogRouteSync({ enableSessionReplay }: Props) {
  const location = useLocation()
  const posthog = usePostHog()
  const lastCapturedUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!posthog) return

    const hostname = window.location.hostname
    const pathname = location.pathname
    const shouldDisable = shouldDisablePostHogForLocation({ hostname, pathname })

    if (shouldDisable) {
      // Hard block: no legacy (/app) + no non-prod domains + no non-allowed routes.
      posthog.stopSessionRecording()
      lastCapturedUrlRef.current = null
      return
    }

    // Manual pageview capture for SPA navigation.
    const currentUrl = window.location.href
    if (lastCapturedUrlRef.current !== currentUrl) {
      lastCapturedUrlRef.current = currentUrl
      posthog.capture("$pageview", {
        $current_url: currentUrl,
      })
    }

    // Replay is opt-in and only runs on allowed routes.
    if (enableSessionReplay) {
      posthog.startSessionRecording()
    } else {
      posthog.stopSessionRecording()
    }
  }, [enableSessionReplay, location.pathname, location.search, posthog])

  return null
}

