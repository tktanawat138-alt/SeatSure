import { expect, test } from '@playwright/test'
import { apiLogin, book, createApprovedCourse, email } from './support/api'
import { PNG, runId } from './support/env'
import { cleanupByTitlePrefix } from './support/service'
import { courseHeading, signInAsDemo } from './support/ui'

// Parent journey on a fresh approved course with two seats, created through the API.
const prefix = `E2E ${runId}`
const title = `${prefix} คอร์สจองและชำระเงิน`
let courseId = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  courseId = (await createApprovedCourse(title, 2)).id
})

test.afterAll(async () => {
  await cleanupByTitlePrefix(prefix)
})

test('parent books from the course list, attaches a proof, confirms and opens the receipt', async ({ page }) => {
  await signInAsDemo(page, 'ผู้ปกครอง 2')
  const card = page.getByRole('listitem').filter({ has: courseHeading(page, title) })
  await expect(card.getByText('เหลือ 2 จาก 2 ที่นั่ง')).toBeVisible()

  await card.getByRole('button', { name: 'ลงทะเบียน' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('ชื่อผู้เรียน').fill('น้องทดสอบ อีทูอี')
  await dialog.getByRole('button', { name: 'ยืนยันการจอง' }).click()

  await expect(page).toHaveURL(/\/bookings$/)
  await expect(page.getByRole('heading', { name: 'การจองของฉัน' })).toBeVisible()
  const booking = page.getByRole('listitem').filter({ hasText: title })
  await expect(booking.getByText('รอชำระเงิน', { exact: true })).toBeVisible()
  await expect(booking.getByText('ผู้เรียน น้องทดสอบ อีทูอี', { exact: false })).toBeVisible()

  await booking.getByLabel('แนบรูปหลักฐานการโอน').setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByText('บันทึกหลักฐานแล้ว กรุณากดยืนยันการชำระเงิน')).toBeVisible()
  await expect(booking.getByText('แนบหลักฐานแล้ว ยังไม่ได้ยืนยันการชำระเงิน')).toBeVisible()

  await booking.getByRole('button', { name: 'ยืนยันการชำระเงิน' }).click()
  await expect(page.getByText('ยืนยันการชำระเงินแล้ว')).toBeVisible()
  await expect(booking.getByText('ชำระแล้ว', { exact: true })).toBeVisible()

  await booking.getByRole('link', { name: 'ดูใบเสร็จ' }).click()
  await expect(page).toHaveURL(/\/receipt\//)
  await expect(page.getByRole('heading', { name: 'ใบยืนยันการจองและใบเสร็จรับเงิน' })).toBeVisible()
  await expect(page.getByText(/^RC-\d{8}-\d{6}$/)).toBeVisible()
  await expect(page.getByText('ชำระแล้ว ยืนยันที่นั่งแล้ว')).toBeVisible()
  await expect(page.getByText(title)).toBeVisible()
})

test('a parent who confirms after the last seat went sees the full message', async ({ page }) => {
  await signInAsDemo(page, 'ผู้ปกครอง 3')
  const card = page.getByRole('listitem').filter({ has: courseHeading(page, title) })
  await expect(card.getByText('เหลือ 1 จาก 2 ที่นั่ง')).toBeVisible()
  await card.getByRole('button', { name: 'ลงทะเบียน' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('ชื่อผู้เรียน')).toBeVisible()

  // Another parent takes the last seat while this dialog is open.
  const other = await apiLogin(email('parent4'))
  await book(other.accessToken, courseId, 'ผู้ปกครองอีกคน')

  await dialog.getByLabel('ชื่อผู้เรียน').fill('น้องมาช้า')
  await dialog.getByRole('button', { name: 'ยืนยันการจอง' }).click()

  await expect(dialog.getByText('คอร์สนี้เต็มแล้ว', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  // The list reloads after the refusal and the card now shows the course as full.
  await dialog.getByRole('button', { name: 'ยกเลิก' }).click()
  await expect(card.getByText('เต็มแล้ว', { exact: true })).toBeVisible()
})
