import { supabase } from '@/integrations/supabase/client'

export async function getOrSignInAnon(): Promise<{ userId: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      console.info('[Auth] Existing session found', { userId: session.user.id })
      return { userId: session.user.id }
    }

    // Attempt anonymous sign-in (Supabase JS v2 supports this)
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.warn('[Auth] Anonymous sign-in failed', { message: error.message })
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


