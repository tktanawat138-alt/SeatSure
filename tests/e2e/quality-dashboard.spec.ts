import { expect, test } from '@playwright/test'
import { signInAsDemo } from './support/ui'

const metricNames = ['Deployment Frequency', 'Lead Time for Changes', 'Change Failure Rate', 'Time to Restore']

test.describe('quality dashboard', () => {
  test('opened by an admin shows DORA metrics and defect density', async ({ page }) => {
    await signInAsDemo(page, 'แอดมิน')
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

  test('is not offered to a parent', async ({ page }) => {
    await signInAsDemo(page, 'ผู้ปกครอง 1')
    // The parent's own menu is up, so a missing link means "not offered", not "not loaded yet".
    await expect(page.getByRole('link', { name: 'การจองของฉัน' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'คุณภาพระบบ' })).toHaveCount(0)

    await page.goto('/quality')
    await expect(page.getByRole('link', { name: 'การจองของฉัน' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'คุณภาพระบบ' })).toHaveCount(0)
  })
})
