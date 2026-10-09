import { createClient } from '@supabase/supabase-js'
import type { TestProject } from 'vitest/node'

// Time each booking spends between checking for a seat and saving it. Both
// modes run with the same delay; it makes concurrent requests overlap on every run.
const CHECK_TO_SAVE_DELAY_MS = 100

// Puts the database in the booking mode under test, and always leaves it safe.
export default async function setup(project: TestProject) {
  const env = project.config.env
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase settings in .env.local. Run: npm run setup')
  }
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  async function configure(mode: string, delayMs: number) {
    const { error } = await admin
      .from('app_settings')
      .update({ booking_mode: mode, check_to_save_delay_ms: delayMs })
      .eq('id', true)
    if (error) throw new Error(`Could not configure booking mode: ${error.message}`)
  }

  const mode = env.BOOKING_MODE ?? 'safe'
  await configure(mode, CHECK_TO_SAVE_DELAY_MS)
  console.log(`\nBooking mode under test: ${mode}\n`)
  return () => configure('safe', 0)
}
