import { afterAll, describe, expect, it } from 'vitest'
import {
  attachProof,
  book,
  cleanup,
  confirmPayment,
  createCourse,
  createUser,
  createUsers,
  expireHold,
  getBooking,
  mustBook,
  mustPay,
  paymentsFor,
  seatsTaken,
} from './helpers'

afterAll(cleanup)

describe('การจ่ายเงินปกติ', () => {
  it('แนบหลักฐานแล้วกดยืนยัน ได้ที่นั่งและใบเสร็จ', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)
    await attachProof(parent, booking.id)

    const { error } = await confirmPayment(parent, booking.id)

    expect(error).toBeNull()
    const payments = await paymentsFor(booking.id)
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ status: 'succeeded', amount: 1500 })
    expect(payments[0].receipt_no).toMatch(/^RC-\d{8}-\d{6}$/)
    expect((await getBooking(booking.id)).status).toBe('paid')
  })

  it('แนบหลักฐานแล้วแต่ยังไม่กดยืนยัน สถานะยังไม่เป็นชำระแล้ว', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)

    await attachProof(parent, booking.id)

    expect((await getBooking(booking.id)).status).toBe('held')
    expect(await paymentsFor(booking.id)).toHaveLength(0)
  })

  it('กดยืนยันโดยไม่มีหลักฐาน ไม่ถูกบันทึกว่าชำระ', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)

    const { error } = await confirmPayment(parent, booking.id)

    expect(error?.message).toBe('payment_proof_required')
    expect((await getBooking(booking.id)).status).toBe('held')
    expect(await paymentsFor(booking.id)).toHaveLength(0)
  })

  it('ยืนยันการชำระแทนการจองของคนอื่นไม่ได้', async () => {
    const course = await createCourse({ capacity: 2 })
    const [owner, stranger] = await createUsers(2)
    const booking = await mustBook(owner, course.id)
    await attachProof(owner, booking.id)

    const { error } = await confirmPayment(stranger, booking.id)

    expect(error?.message).toBe('booking_not_found')
    expect((await getBooking(booking.id)).status).toBe('held')
    expect(await paymentsFor(booking.id)).toHaveLength(0)
  })
})

describe('R2 ไม่ซ้ำ: จองซ้ำไม่ได้ และไม่ถูกบันทึกเงินซ้ำ', () => {
  it('กดจองคอร์สเดิมรัว 5 ครั้งพร้อมกัน ได้การจองเดียว', async () => {
    const course = await createCourse({ capacity: 10 })
    const parent = await createUser()

    const results = await Promise.all(Array.from({ length: 5 }, () => book(parent, course.id)))

    expect(results.filter((r) => !r.error)).toHaveLength(1)
    expect(await seatsTaken(course.id)).toBe(1)
  })

  it('กดยืนยันรัว 5 ครั้งพร้อมกัน ถูกบันทึกเงินครั้งเดียว', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)
    await attachProof(parent, booking.id)

    await Promise.all(Array.from({ length: 5 }, () => confirmPayment(parent, booking.id)))

    expect(await paymentsFor(booking.id), 'จำนวนรายการเงิน').toHaveLength(1)
    expect((await getBooking(booking.id)).status).toBe('paid')
  })

  it('ยืนยันแล้วกลับมายืนยันอีกรอบ ได้ใบเสร็จใบเดิม ไม่ถูกบันทึกเงินซ้ำ', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)
    await mustPay(parent, booking.id)
    const [first] = await paymentsFor(booking.id)

    const { error } = await confirmPayment(parent, booking.id)

    expect(error).toBeNull()
    const payments = await paymentsFor(booking.id)
    expect(payments, 'จำนวนรายการเงิน').toHaveLength(1)
    expect(payments[0].receipt_no).toBe(first.receipt_no)
  })
})

describe('R2 ไม่หลุด: เงินที่บันทึกต้องมีที่นั่ง และที่นั่งไม่เกินจำนวนรับ', () => {
  it('ยืนยันหลังหมดเวลา แต่ที่นั่งยังว่าง ยังได้ที่นั่ง', async () => {
    const course = await createCourse({ capacity: 1 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)
    await attachProof(parent, booking.id)
    await expireHold(booking.id)

    const { error } = await confirmPayment(parent, booking.id)

    expect(error).toBeNull()
    expect((await getBooking(booking.id)).status, 'สถานะการจองหลังยืนยัน').toBe('paid')
    expect(await paymentsFor(booking.id)).toHaveLength(1)
    expect(await seatsTaken(course.id)).toBe(1)
  })

  it('ยืนยันหลังหมดเวลา และที่นั่งถูกคนอื่นจองไปแล้ว ไม่ถูกบันทึกเงินและที่นั่งไม่เกิน', async () => {
    const course = await createCourse({ capacity: 1 })
    const [late, quick] = await createUsers(2)
    const lapsed = await mustBook(late, course.id)
    await attachProof(late, lapsed.id)
    await expireHold(lapsed.id)
    const taken = await mustBook(quick, course.id)
    await mustPay(quick, taken.id)

    const { error } = await confirmPayment(late, lapsed.id)

    expect(error?.message, 'คำตอบที่คนยืนยันช้าได้รับ').toBe('booking_not_payable')
    expect(await paymentsFor(lapsed.id), 'รายการเงินของคนที่ยืนยันช้า').toHaveLength(0)
    expect((await getBooking(lapsed.id)).status).toBe('expired')
    expect((await getBooking(taken.id)).status).toBe('paid')
    expect(await seatsTaken(course.id)).toBe(1)
  })
})
