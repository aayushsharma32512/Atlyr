import { supabase } from '@/integrations/supabase/client'

/** When false, skip anonymous sign-in (avoids POST /auth/v1/signup 422 if Anonymous is off in Supabase). */
const anonymousAuthAllowed = () => {
  const v = import.meta.env.VITE_SUPABASE_ANONYMOUS_AUTH
  return v !== 'false' && v !== '0'
}

export async function getOrSignInAnon(): Promise<{ userId: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      console.info('[Auth] Existing session found', { userId: session.user.id })
      return { userId: session.user.id }
    }

    if (!anonymousAuthAllowed()) {
      return { userId: null }
    }

    // Anonymous users are created via the same signup endpoint as email signups.
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      const code = "code" in error ? (error as { code?: string }).code : undefined
      if (code === "anonymous_provider_disabled") {
        console.warn(
          "[Auth] Anonymous sign-in is off in Supabase (enable under Authentication → Providers → Anonymous), or set VITE_SUPABASE_ANONYMOUS_AUTH=false to skip guest sign-in."
        )
      } else {
        console.warn("[Auth] Anonymous sign-in failed", { message: error.message })
      }
      return { userId: null }
    }
    const anonId = data?.user?.id ?? null
    console.info('[Auth] Anonymous session created', { userId: anonId })
    return { userId: anonId }
  } catch (e) {
    console.error('[Auth] getOrSignInAnon exception', { message: (e as Error).message })
    return { userId: null }
  }
}


