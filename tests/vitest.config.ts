import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Cross-app integration: the frontend's real adaptors against the real local Supabase.
// Keys come from apps/frontend/.env.local, written by `task up`.
const envFile = new URL('../apps/frontend/.env.local', import.meta.url)
const keys = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('../apps/frontend/src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['integration/**/*.test.ts'],
    env: keys,
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
