import { expect, test } from '@playwright/test'

const metricNames = ['Deployment Frequency', 'Lead Time for Changes', 'Change Failure Rate', 'Time to Restore']

// The two tests sign in one after the other, not at once. When two sign-ins overlap, the local
// PostgREST can reject the newer token with "JWT issued at future" (PGRST303) and the app then
// drops back to the login page without a message.
test.describe.configure({ mode: 'default' })

test('quality dashboard opened by an admin shows DORA metrics and defect density', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'แอดมิน', exact: true }).click()
  await page.getByRole('link', { name: 'คุณภาพระบบ' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'คุณภาพระบบ' })).toBeVisible()
  await expect(page.getByText('ข้อมูลตัวอย่าง', { exact: true })).toBeVisible()

  const cards = page.getByRole('region', { name: 'DORA Metrics' })
  for (const name of metricNames) {
    await expect(cards.getByRole('heading', { level: 3, name, exact: true })).toBeVisible()
  }

  const density = page.getByRole('region', { name: 'Defect Density รายโมดูล' })
  await expect(density.getByRole('row').filter({ hasText: 'ชำระเงิน' })).toBeVisible()
  await expect(density.getByRole('row').filter({ hasText: 'รวมทั้งระบบ' })).toBeVisible()
})

test('quality dashboard is not offered to a parent', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'ผู้ปกครอง 1', exact: true }).click()
  // The parent's own menu is up, so a missing link means "not offered", not "not loaded yet".
  // Sign-in plus the first page load can take longer than the default 5 s on a cold dev server.
  await expect(page.getByRole('link', { name: 'การจองของฉัน' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'คุณภาพระบบ' })).toHaveCount(0)

  await page.goto('/quality')
  await expect(page.getByRole('link', { name: 'การจองของฉัน' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'คุณภาพระบบ' })).toHaveCount(0)
})
