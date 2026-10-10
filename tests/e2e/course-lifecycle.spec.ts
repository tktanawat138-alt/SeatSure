import { expect, test } from '@playwright/test'
import { apiLogin, bookAndPay, createApprovedCourse, email } from './support/api'
import { runId } from './support/env'
import { cleanupByTitlePrefix } from './support/service'
import { courseHeading, localDateTime, signInAsDemo, signInWithForm } from './support/ui'

// Teacher submits, admin01 approves, parent sees; admin cancels a paid course and gets the refund count.
const prefix = `E2E ${runId}`
const submitted = `${prefix} คอร์สที่ครูส่ง`
const toCancel = `${prefix} คอร์สที่จะยกเลิก`
const SEEDED_COURSE = 'คณิตศาสตร์เสริม ม.1'

test.describe.configure({ mode: 'serial' })

test.afterAll(async () => {
  await cleanupByTitlePrefix(prefix)
})

test('teacher submits a course through the form and it waits for approval', async ({ page }) => {
  await signInAsDemo(page, 'ครู')
  await expect(page.getByRole('heading', { name: 'รายชื่อผู้เรียน' })).toBeVisible()

  await page.getByRole('button', { name: 'เพิ่มคอร์ส' }).click()
  const dialog = page.getByRole('dialog')
  const starts = new Date(Date.now() + 14 * 86_400_000)
  starts.setHours(9, 0, 0, 0)
  const ends = new Date(starts.getTime() + 2 * 3_600_000)
  await dialog.getByLabel('ชื่อคอร์ส').fill(submitted)
  await dialog.getByLabel('รายละเอียด').fill('คอร์สทดสอบจาก e2e')
  await dialog.getByLabel('เริ่มวันที่และเวลา').fill(localDateTime(starts))
  await dialog.getByLabel('สิ้นสุดวันที่และเวลา').fill(localDateTime(ends))
  await dialog.getByLabel('จำนวนรับ (คน)').fill('5')
  await dialog.getByLabel('ราคา (บาท)').fill('1200')
  await dialog.getByRole('button', { name: 'เพิ่มคอร์ส' }).click()

  await expect(page.getByText('ส่งคอร์สให้แอดมินโรงเรียนอนุมัติแล้ว')).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(courseHeading(page, submitted)).toBeVisible()
  await expect(page.getByText(/[1-9]\d* คอร์สรอแอดมินอนุมัติ/)).toBeVisible()
})

test('a pending course is not shown to parents', async ({ page }) => {
  await signInAsDemo(page, 'ผู้ปกครอง 1')
  await expect(courseHeading(page, SEEDED_COURSE)).toBeVisible()

  await expect(courseHeading(page, submitted)).toHaveCount(0)
})

test('admin (not admin01) is not shown the approval queue', async ({ page }) => {
  await signInAsDemo(page, 'แอดมิน')
  await expect(page.getByRole('heading', { name: 'จัดการคอร์ส' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: SEEDED_COURSE })).toBeVisible()

  await expect(page.getByRole('heading', { name: 'คอร์สรออนุมัติจากครู' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: `อนุมัติ ${submitted}` })).toHaveCount(0)
})

test('admin01 approves the course from the queue', async ({ page }) => {
  await signInWithForm(page, 'admin01@seatsure.test')
  await expect(page.getByRole('heading', { name: 'คอร์สรออนุมัติจากครู' })).toBeVisible()

  await page.getByRole('button', { name: `อนุมัติ ${submitted}` }).click()

  await expect(page.getByText('อนุมัติคอร์สแล้ว')).toBeVisible()
  await expect(page.getByRole('button', { name: `อนุมัติ ${submitted}` })).toHaveCount(0)
})

test('the approved course is then shown to parents', async ({ page }) => {
  await signInAsDemo(page, 'ผู้ปกครอง 1')

  const card = page.getByRole('listitem').filter({ has: courseHeading(page, submitted) })
  await expect(card).toBeVisible()
  await expect(card.getByRole('button', { name: 'ลงทะเบียน' })).toBeVisible()
})

test('admin cancels a course with a paid booking and sees one refund', async ({ page }) => {
  const course = await createApprovedCourse(toCancel, 3)
  const parent = await apiLogin(email('parent5'))
  await bookAndPay(parent.accessToken, course.id, 'น้องจ่ายแล้ว')

  await signInAsDemo(page, 'แอดมิน')
  const row = page.getByRole('row').filter({ hasText: toCancel })
  await row.getByRole('button', { name: 'ยกเลิกคอร์ส' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('เหตุผลที่ยกเลิก').fill('ครูติดภารกิจ (e2e)')
  await dialog.getByRole('button', { name: 'ยืนยันยกเลิกคอร์ส' }).click()

  await expect(page.getByText('เพิ่มรายการคืนเงิน 1 รายการ')).toBeVisible()
  await expect(row.getByText('ยกเลิกแล้ว', { exact: true })).toBeVisible()
})
