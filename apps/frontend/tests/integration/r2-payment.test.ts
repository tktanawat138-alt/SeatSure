import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  book,
  cleanup,
  createCourse,
  createUser,
  createUsers,
  expireHold,
  getBooking,
  mustBook,
  pay,
  paymentsFor,
  seatsTaken,
} from './helpers'

afterAll(cleanup)

describe('การจ่ายเงินปกติ', () => {
  it('จ่ายภายในเวลา ได้ที่นั่งและใบเสร็จ', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)

    const { data: payment, error } = await pay(parent, booking.id)

    expect(error).toBeNull()
    expect(payment).toMatchObject({ status: 'succeeded', amount: 1500 })
    expect(payment?.receipt_no).toMatch(/^RC-\d{8}-\d{6}$/)
    expect((await getBooking(booking.id)).status).toBe('paid')
  })

  it('จ่ายแทนการจองของคนอื่นไม่ได้', async () => {
    const course = await createCourse({ capacity: 2 })
    const [owner, stranger] = await createUsers(2)
    const booking = await mustBook(owner, course.id)

    const { error } = await pay(stranger, booking.id)

    expect(error?.message).toBe('booking_not_found')
    expect(await paymentsFor(booking.id)).toHaveLength(0)
  })
})

describe('R2 ไม่ซ้ำ: จองซ้ำไม่ได้ และไม่ถูกเก็บเงินซ้ำ', () => {
  it('กดจองคอร์สเดิมรัว 5 ครั้งพร้อมกัน ได้การจองเดียว', async () => {
    const course = await createCourse({ capacity: 10 })
    const parent = await createUser()

    const results = await Promise.all(Array.from({ length: 5 }, () => book(parent, course.id)))

    expect(results.filter((r) => !r.error)).toHaveLength(1)
    expect(await seatsTaken(course.id)).toBe(1)
  })

  it('กดจ่ายรัว 5 ครั้งพร้อมกัน (คำขอเดียวกัน) ถูกเก็บเงินครั้งเดียว', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)
    const key = randomUUID()

    await Promise.all(Array.from({ length: 5 }, () => pay(parent, booking.id, key)))

    expect(await paymentsFor(booking.id), 'จำนวนรายการเก็บเงิน').toHaveLength(1)
    expect((await getBooking(booking.id)).status).toBe('paid')
  })

  it('ส่งคำขอจ่ายเดิมซ้ำ ได้ใบเสร็จใบเดิมกลับมา', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)
    const key = randomUUID()

    const first = await pay(parent, booking.id, key)
    const retry = await pay(parent, booking.id, key)

    expect(retry.error).toBeNull()
    expect(retry.data?.receipt_no).toBe(first.data?.receipt_no)
    expect(await paymentsFor(booking.id)).toHaveLength(1)
  })

  it('จ่ายแล้วกลับมาจ่ายอีกรอบ ไม่ถูกเก็บเงินซ้ำ', async () => {
    const course = await createCourse({ capacity: 2 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)
    await pay(parent, booking.id)

    const { error } = await pay(parent, booking.id)

    expect(await paymentsFor(booking.id), 'จำนวนรายการเก็บเงิน').toHaveLength(1)
    expect(error?.message).toBe('already_paid')
  })
})

describe('R2 ไม่หลุด: เงินที่รับมาต้องมีที่นั่ง หรือถูกบันทึกว่าต้องคืน', () => {
  it('จ่ายหลังหมดเวลา แต่ที่นั่งยังว่าง ยังได้ที่นั่ง', async () => {
    const course = await createCourse({ capacity: 1 })
    const parent = await createUser()
    const booking = await mustBook(parent, course.id)
    await expireHold(booking.id)

    const { data: payment } = await pay(parent, booking.id)

    expect(payment?.status).toBe('succeeded')
    expect((await getBooking(booking.id)).status, 'สถานะการจองหลังจ่ายเงิน').toBe('paid')
    expect(await seatsTaken(course.id)).toBe(1)
  })

  it('จ่ายหลังหมดเวลา และที่นั่งถูกคนอื่นจองไปแล้ว ระบบบันทึกว่าต้องคืนเงิน', async () => {
    const course = await createCourse({ capacity: 1 })
    const [late, quick] = await createUsers(2)
    const lapsed = await mustBook(late, course.id)
    await expireHold(lapsed.id)
    const taken = await mustBook(quick, course.id)
    await pay(quick, taken.id)

    const { data: payment } = await pay(late, lapsed.id)

    expect(payment?.status, 'สถานะเงินของคนที่จ่ายช้า').toBe('refund_due')
    expect((await getBooking(lapsed.id)).status).toBe('expired')
    expect((await getBooking(taken.id)).status).toBe('paid')
    expect(await seatsTaken(course.id)).toBe(1)
  })
})
