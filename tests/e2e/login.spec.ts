import { expect, test } from '@playwright/test'

test('login page shows the sign-in form to a visitor', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible()
  await expect(page.locator('input[type=email]')).toBeVisible()
  await expect(page.locator('input[type=password]')).toBeVisible()
})
