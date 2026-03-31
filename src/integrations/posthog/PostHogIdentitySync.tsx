import { useEffect } from "react"
import { usePostHog } from "posthog-js/react"

import { useAuth } from "@/contexts/AuthContext"
import { useProfileContext } from "@/features/profile/providers/ProfileProvider"
import { shouldDisablePostHogForLocation } from "@/integrations/posthog/posthogRoutePolicy"

export function PostHogIdentitySync() {
  const posthog = usePostHog()
  const { user } = useAuth()
  const { profile, role, isLoading: isProfileLoading } = useProfileContext()

  // Reset on logout so identities don't merge across shared browsers.
  useEffect(() => {
    if (!posthog) return
    if (user) return
    posthog.reset()
  }, [posthog, user])

  // Identify as soon as we know the authenticated user.
  useEffect(() => {
    if (!posthog) return
    if (!user?.id) return
    const hostname = window.location.hostname
    const pathname = window.location.pathname
    if (shouldDisablePostHogForLocation({ hostname, pathname })) return

    const email = user.email ?? null
    const name = typeof profile?.name === "string" ? profile.name : null

    posthog.identify(user.id, {
      email,
      name,
      role,
    })
  }, [posthog, profile?.name, role, user?.email, user?.id])

  // If profile is still loading, don't thrash person props.
  useEffect(() => {
    if (!posthog) return
    if (!user?.id) return
    if (isProfileLoading) return
    const hostname = window.location.hostname
    const pathname = window.location.pathname
    if (shouldDisablePostHogForLocation({ hostname, pathname })) return

    const email = user.email ?? null
    const name = typeof profile?.name === "string" ? profile.name : null

    // Ensure role/name stay updated when profile becomes available.
    posthog.identify(user.id, {
      email,
      name,
      role,
    })
  }, [isProfileLoading, posthog, profile?.name, role, user?.email, user?.id])

  return null
}

