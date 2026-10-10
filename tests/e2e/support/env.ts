import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

// Test-side only. The service key in apps/backend/.env.local (written by `task up`) is used to
// arrange and clean data; it never goes near the frontend bundle.
const file = new URL('../../../apps/backend/.env.local', import.meta.url)

export const API_URL = process.env.API_URL ?? 'http://localhost:3001'
export const PASSWORD = 'seatsure123'

export function backendEnv() {
  if (!existsSync(file)) throw new Error('apps/backend/.env.local is missing: run `task up` first')
  const env = parseEnv(readFileSync(file, 'utf8'))
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in apps/backend/.env.local')
  return { url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY }
}

/** Unique per test process, so titles never collide with an earlier or parallel run. */
export const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// 1x1 transparent PNG
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
