'use client'
import { createMockClient } from './mock-client'
import type { DbClient } from './db-client'
import { createBrowserClient } from '@supabase/ssr'

export function createClient(): DbClient {
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
    return createMockClient()
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  ) as unknown as DbClient
}
