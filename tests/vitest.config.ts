import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Cross-app integration: the frontend's real HTTP gateways and use cases against the running API
// (task up). The data arranged or cleaned on the side uses the service key read by
// e2e/support/env.ts, never the frontend.
export default defineConfig({
  resolve: {
    alias: {
      '@contract': fileURLToPath(new URL('../apps/backend/src/adaptor/http/contract.ts', import.meta.url)),
      '@': fileURLToPath(new URL('../apps/frontend/src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['integration/**/*.test.ts'],
    setupFiles: ['integration/local-storage.ts'],
    env: { VITE_API_URL: process.env.API_URL ?? 'http://localhost:3001' },
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
