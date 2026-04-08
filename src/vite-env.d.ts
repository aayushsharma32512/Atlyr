/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_POSTHOG_KEY: string
  readonly VITE_PUBLIC_POSTHOG_HOST: string
  /** Set to "false" or "0" to skip anonymous sign-in (guest likeness/VTO/try-on need a real session or Anonymous enabled in Supabase). */
  readonly VITE_SUPABASE_ANONYMOUS_AUTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}