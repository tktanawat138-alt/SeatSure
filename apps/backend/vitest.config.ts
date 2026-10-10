import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { defineConfig } from 'vitest/config'

// Keys come from apps/frontend/.env.local, written by `task up`.
const envFile = new URL('../frontend/.env.local', import.meta.url)
const keys = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}

// `vitest run --mode unsafe` runs the same tests against the naive booking code.
export default defineConfig(({ mode }) => ({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    env: { ...keys, BOOKING_MODE: mode === 'unsafe' ? 'unsafe' : 'safe' },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
}))
