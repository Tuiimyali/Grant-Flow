import { createBrowserClient } from '@supabase/ssr'

// Module-level singleton — all hooks share one client so the auth session
// lock (Web Locks API) is never contested, preventing AbortError: "Lock broken
// by another request with the 'steal' option."
let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}
