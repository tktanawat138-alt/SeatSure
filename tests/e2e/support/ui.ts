import { expect, type Page } from '@playwright/test'
import { PASSWORD } from './env'

export const SESSION_KEY = 'seatsure.session'

/** Signs in through the form on the login page. */
export async function signInWithForm(page: Page, email: string, password = PASSWORD) {
  await page.goto('/')
  await page.getByLabel('อีเมล').fill(email)
  await page.getByLabel('รหัสผ่าน').fill(password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
}

/** Signs in with one of the demo-account buttons (dev server only), e.g. "ผู้ปกครอง 2", "ครู", "แอดมิน". */
export async function signInAsDemo(page: Page, label: string) {
  await page.goto('/')
  await page.getByRole('button', { name: label, exact: true }).click()
  await expect(page.getByRole('button', { name: 'ออกจากระบบ' })).toBeVisible()
}

/** The heading of a course card or roster card, by its exact title. */
export const courseHeading = (page: Page, title: string) => page.getByRole('heading', { name: title, exact: true })

/** Value for an <input type="datetime-local">, in the browser's local time. */
export function localDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
