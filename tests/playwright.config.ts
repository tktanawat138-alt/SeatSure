import { defineConfig, devices } from '@playwright/test'

// Cross-app e2e: the browser drives the frontend, which talks only to the API, against local
// Supabase + seed data. The specs share seeded accounts and arrange data through the API, so they
// run one at a time.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  globalSetup: './e2e/support/global-setup.ts',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm start --prefix ../apps/backend',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev --prefix ../apps/frontend -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
