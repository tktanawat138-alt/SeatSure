import { expect, test } from '@playwright/test'
import { SESSION_KEY, courseHeading, signInAsDemo, signInWithForm } from './support/ui'

const SEEDED_COURSE = 'คณิตศาสตร์เสริม ม.1'

test.describe('auth', () => {
  test('parent sign-in lands on the course list', async ({ page }) => {
    await signInAsDemo(page, 'ผู้ปกครอง 1')

    await expect(page.getByRole('heading', { name: 'คอร์สเรียนเสริม' })).toBeVisible()
    await expect(courseHeading(page, SEEDED_COURSE)).toBeVisible()
  })

  test('wrong password shows the Thai error and stays on the login page', async ({ page }) => {
    await signInWithForm(page, 'parent1@seatsure.test', 'wrong-password')

    await expect(page.getByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible()
    expect(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).toBeNull()
  })

  test('logout returns to the login page and forgets the session', async ({ page }) => {
    await signInWithForm(page, 'parent1@seatsure.test')
    await expect(page.getByRole('heading', { name: 'คอร์สเรียนเสริม' })).toBeVisible()

    await page.getByRole('button', { name: 'ออกจากระบบ' }).click()

    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible()
    expect(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).toBeNull()
  })

  test('a protected route while signed out shows the login page', async ({ page }) => {
    await page.goto('/bookings')

    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })

  test('a garbled access token is refreshed silently and the page still loads data after a reload', async ({ page }) => {
    await signInAsDemo(page, 'ผู้ปกครอง 1')
    await expect(courseHeading(page, SEEDED_COURSE)).toBeVisible()

    await page.evaluate((key) => {
      const session = JSON.parse(localStorage.getItem(key)!)
      localStorage.setItem(key, JSON.stringify({ ...session, accessToken: 'garbage.not.a.jwt' }))
    }, SESSION_KEY)
    await page.reload()

    await expect(page.getByRole('heading', { name: 'คอร์สเรียนเสริม' })).toBeVisible()
    await expect(courseHeading(page, SEEDED_COURSE)).toBeVisible()
    await expect
      .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').accessToken, SESSION_KEY))
      .not.toBe('garbage.not.a.jwt')
  })

  test('garbled access and refresh tokens sign the user out', async ({ page }) => {
    await signInAsDemo(page, 'ผู้ปกครอง 1')
    await expect(courseHeading(page, SEEDED_COURSE)).toBeVisible()

    await page.evaluate((key) => {
      const session = JSON.parse(localStorage.getItem(key)!)
      localStorage.setItem(key, JSON.stringify({ ...session, accessToken: 'garbage.access', refreshToken: 'garbage-refresh' }))
    }, SESSION_KEY)
    await page.reload()

    await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible()
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).toBeNull()
  })
})
