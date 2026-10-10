import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { defineConfig } from 'vitest/config'

// Integration keys come from apps/frontend/.env.local, written by `task up`.
const envFile = new URL('../frontend/.env.local', import.meta.url)
const keys = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}

// `vitest run --mode unsafe` runs the integration tests against the naive booking code.
export default defineConfig(({ mode }) => ({
  test: {
    projects: [
      {
        // No services, no env: fake deps only.
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/global-setup.ts'],
          env: { ...keys, BOOKING_MODE: mode === 'unsafe' ? 'unsafe' : 'safe' },
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
}))
