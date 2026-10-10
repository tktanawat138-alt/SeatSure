import { afterAll, describe, expect, it } from 'vitest'
import {
  attachProof,
  cleanup,
  confirmPayment,
  createCourse,
  createUser,
  createUsers,
  getBooking,
  mustBook,
  pay,
  paymentsFor,
  seatsTaken,
} from './helpers'

afterAll(cleanup)

// Payment is a bank transfer: attach a proof image, then press "confirm".
describe('การจ่ายเงินด้วยการโอน', () => {
  it('แนบหลักฐานแล้ว ยังไม่ถือว่าชำระ จนกว่าจะกดยืนยัน', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)

    await attachProof(parent, booking.id)

    expect((await getBooking(booking.id)).status).toBe('held')
    expect(await paymentsFor(booking.id)).toHaveLength(0)
  })

  it('กดยืนยันหลังแนบหลักฐาน ได้ที่นั่งและใบเสร็จ', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)
    await attachProof(parent, booking.id)

    const { error } = await confirmPayment(parent, booking.id)

    const payments = await paymentsFor(booking.id)
    expect(error).toBeNull()
    expect(payments).toHaveLength(1)
    expect(payments[0].status).toBe('succeeded')
    expect(payments[0].receipt_no).toMatch(/^RC-\d{8}-\d{6}$/)
    expect((await getBooking(booking.id)).status).toBe('paid')
    expect(await seatsTaken(course.id)).toBe(1)
  })

  it('กดยืนยันโดยไม่แนบหลักฐาน ไม่ได้', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)

    const { error } = await confirmPayment(parent, booking.id)

    expect(error?.message).toBe('payment_proof_required')
    expect(await paymentsFor(booking.id)).toHaveLength(0)
  })

  it('ยืนยันการจองของคนอื่นไม่ได้', async () => {
    const course = await createCourse({ capacity: 2 })
    const [owner, other] = await createUsers(2)
    const booking = await mustBook(owner, course.id)
    await attachProof(owner, booking.id)

    const { error } = await confirmPayment(other, booking.id)

    expect(error?.message).toBe('booking_not_found')
    expect((await getBooking(booking.id)).status).toBe('held')
  })

  it('บัตรไม่รับแล้ว pay_booking ปฏิเสธ รับเฉพาะการโอน', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)

    const { error } = await pay(parent, booking.id)

    expect(error?.message).toBe('bank_transfer_only')
    expect(await paymentsFor(booking.id)).toHaveLength(0)
  })
})

describe('R2 ไม่ซ้ำ: ยืนยันกี่ครั้งก็ถูกเก็บเงินครั้งเดียว', () => {
  it('กดยืนยันรัว 5 ครั้งพร้อมกัน ถูกเก็บเงินครั้งเดียว', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)
    await attachProof(parent, booking.id)

    await Promise.all(Array.from({ length: 5 }, () => confirmPayment(parent, booking.id)))

    expect(await paymentsFor(booking.id), 'จำนวนรายการเก็บเงิน').toHaveLength(1)
    expect((await getBooking(booking.id)).status).toBe('paid')
  })

  it('ยืนยันซ้ำหลังชำระแล้ว ไม่ error และไม่ถูกเก็บเงินซ้ำ', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)
    await attachProof(parent, booking.id)
    await confirmPayment(parent, booking.id)

    const { error } = await confirmPayment(parent, booking.id)

    expect(error).toBeNull()
    expect(await paymentsFor(booking.id), 'จำนวนรายการเก็บเงิน').toHaveLength(1)
  })
})
