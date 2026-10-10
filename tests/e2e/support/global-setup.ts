import { cleanupByTitlePrefix } from './service'

// Each spec cleans up after itself; this removes what an interrupted earlier run left behind.
export default async function globalSetup() {
  await cleanupByTitlePrefix('E2E ')
}
