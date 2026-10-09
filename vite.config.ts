import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// `vitest run --mode unsafe` runs the same tests against the naive booking code.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    env: {
      ...loadEnv(mode, process.cwd(), ['VITE_SUPABASE_', 'SUPABASE_']),
      BOOKING_MODE: mode === 'unsafe' ? 'unsafe' : 'safe',
    },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
}))
