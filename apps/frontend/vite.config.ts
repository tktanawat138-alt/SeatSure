import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Unit + integration (adaptors over a stubbed network). DB integration lives in apps/backend,
  // cross-app integration and e2e in /tests. The Supabase URL is fake: no test here reaches a real server.
  test: {
    environment: 'node',
    include: ['tests/{unit,integration}/**/*.test.ts'],
    env: { VITE_SUPABASE_URL: 'http://supabase.test', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
  },
})
