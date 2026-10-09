import { afterAll, describe, expect, it } from 'vitest'
import { admin, book, cleanup, createCourse, createUser, createUsers, expireHold, mustBook, seatsTaken } from './helpers'

afterAll(cleanup)

describe('R1 ไม่เกิน: ที่นั่งที่ถูกจองต้องไม่เกินจำนวนที่รับ', () => {
  it('20 คนกดจองที่นั่งสุดท้ายพร้อมกัน ได้ที่นั่งคนเดียว', async () => {
    const course = await createCourse({ capacity: 1 })
    const parents = await createUsers(20)

    const results = await Promise.all(parents.map((parent) => book(parent, course.id)))

    const refusals = results.filter((r) => r.error).map((r) => r.error!.message)
    expect(await seatsTaken(course.id), 'ที่นั่งที่ถูกจอง (คอร์สรับ 1 คน)').toBe(1)
    expect(results.filter((r) => !r.error), 'จำนวนคนที่จองสำเร็จ').toHaveLength(1)
    expect(new Set(refusals)).toEqual(new Set(['course_full']))
  })

  it('25 คนแย่ง 5 ที่นั่งพร้อมกัน ได้ที่นั่งพอดี 5 คน', async () => {
    const course = await createCourse({ capacity: 5 })
    const parents = await createUsers(25)

    const results = await Promise.all(parents.map((parent) => book(parent, course.id)))

    expect(await seatsTaken(course.id), 'ที่นั่งที่ถูกจอง (คอร์สรับ 5 คน)').toBe(5)
    expect(results.filter((r) => !r.error), 'จำนวนคนที่จองสำเร็จ').toHaveLength(5)
  })

  it('คอร์สเต็มแล้ว คนถัดไปจองไม่ได้', async () => {
    const course = await createCourse({ capacity: 1 })
    const [first, second] = await createUsers(2)
    await mustBook(first, course.id)

    const { error } = await book(second, course.id)

    expect(error?.message).toBe('course_full')
    expect(await seatsTaken(course.id)).toBe(1)
  })

  it('ปิดรับสมัครแล้วจองไม่ได้', async () => {
    const course = await createCourse({ capacity: 5, registrationOpen: false })
    const parent = await createUser()

    const { error } = await book(parent, course.id)

    expect(error?.message).toBe('registration_closed')
    expect(await seatsTaken(course.id)).toBe(0)
  })

  it('ที่นั่งที่จองไว้แต่ไม่จ่ายจนหมดเวลา ถูกปล่อยให้คนอื่นจองได้', async () => {
    const course = await createCourse({ capacity: 1 })
    const [first, second] = await createUsers(2)
    const lapsed = await mustBook(first, course.id)
    await expireHold(lapsed.id)

    const { error } = await book(second, course.id)

    expect(error).toBeNull()
    expect(await seatsTaken(course.id)).toBe(1)
  })

  it('แอดมินลดจำนวนรับให้ต่ำกว่าที่จองไปแล้วไม่ได้', async () => {
    const course = await createCourse({ capacity: 3 })
    const [staff, ...parents] = await Promise.all([createUser('admin'), createUser(), createUser()])
    for (const parent of parents) await mustBook(parent, course.id)

    const { error } = await staff.client.from('courses').update({ capacity: 1 }).eq('id', course.id)

    expect(error?.message).toBe('capacity_below_booked')
    const { data } = await admin.from('courses').select('capacity').eq('id', course.id).single()
    expect(data?.capacity).toBe(3)
  })
})
