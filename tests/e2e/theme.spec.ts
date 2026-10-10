import { expect, test, type Page } from '@playwright/test'

const toggle = (page: Page) => page.getByRole('button', { name: 'เปลี่ยนธีม' })
const choose = async (page: Page, label: 'สว่าง' | 'มืด' | 'ตามระบบ') => {
  await toggle(page).click()
  await page.getByRole('menuitemradio', { name: label }).click()
}
const html = (page: Page) => page.locator('html')

test.describe('theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('the toggle on the login page switches to dark and back', async ({ page }) => {
    await expect(html(page)).not.toHaveClass(/dark/)
    await choose(page, 'มืด')
    await expect(html(page)).toHaveClass(/dark/)
    await choose(page, 'สว่าง')
    await expect(html(page)).not.toHaveClass(/dark/)
  })

  test('the choice survives a reload without a flash of the wrong theme', async ({ page }) => {
    await choose(page, 'มืด')
    await page.reload()
    await expect(html(page)).toHaveClass(/dark/)
    await expect(toggle(page)).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('seatsure-theme'))).toBe('dark')
  })

  test('the class is already set before the app loads', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('seatsure-theme', 'dark'))
    // Block the module that mounts React: only the inline script in index.html can have set the class.
    await page.route('**/src/main.tsx*', (route) => route.abort())
    await page.reload()
    await expect(html(page)).toHaveClass(/dark/)
    await expect(page.locator('#root')).toBeEmpty()
  })

  test('system follows the operating system, live', async ({ page }) => {
    await choose(page, 'ตามระบบ')
    await expect(html(page)).not.toHaveClass(/dark/)
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(html(page)).toHaveClass(/dark/)
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(html(page)).not.toHaveClass(/dark/)
  })

  test('an explicit choice ignores the operating system', async ({ page }) => {
    await choose(page, 'สว่าง')
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(html(page)).not.toHaveClass(/dark/)
  })

  test('native controls follow the theme through color-scheme', async ({ page }) => {
    await choose(page, 'มืด')
    await expect(html(page)).toHaveCSS('color-scheme', 'dark')
  })

  test('works from the keyboard', async ({ page }) => {
    await toggle(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitemradio', { name: 'สว่าง' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('menuitemradio', { name: 'มืด' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(html(page)).toHaveClass(/dark/)
  })

  test('has no running transition when the visitor prefers reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(toggle(page)).toHaveCSS('transition-duration', '0s')
  })

  test('keeps the transition for everyone else', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(toggle(page)).not.toHaveCSS('transition-duration', '0s')
  })
})
