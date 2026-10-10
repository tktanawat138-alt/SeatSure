import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  admin,
  cleanup,
  createCourse,
  createUser,
  getBooking,
  mustBook,
  mustPay,
  visitor,
  type TestUser,
} from './helpers'

let alice: TestUser
let bob: TestUser
let teacher: TestUser
let otherTeacher: TestUser
let course: Awaited<ReturnType<typeof createCourse>>
let aliceBookingId: string

beforeAll(async () => {
  ;[alice, bob, teacher, otherTeacher] = await Promise.all([
    createUser(),
    createUser(),
    createUser('teacher'),
    createUser('teacher'),
  ])
  course = await createCourse({ capacity: 5, teacherId: teacher.id })

  const aliceBooking = await mustBook(alice, course.id)
  aliceBookingId = aliceBooking.id
  await mustPay(alice, aliceBooking.id)
  await mustBook(bob, course.id)

  const { error } = await admin.from('grades').insert([
    { course_id: course.id, student_id: alice.id, grade: 'A' },
    { course_id: course.id, student_id: bob.id, grade: 'C' },
  ])
  if (error) throw error
})

afterAll(cleanup)

describe('ความปลอดภัย: แต่ละคนเห็นเฉพาะข้อมูลของตัวเอง', () => {
  it('ผู้ปกครองเห็นเฉพาะการจองและใบเสร็จของตัวเอง', async () => {
    const { data: bookings } = await bob.client.from('bookings').select().eq('course_id', course.id)
    const { data: payments } = await bob.client.from('payments').select().eq('booking_id', aliceBookingId)

    expect(bookings?.map((b) => b.user_id)).toEqual([bob.id])
    expect(payments).toEqual([])
  })

  it('นักเรียนเห็นเฉพาะเกรดของตัวเอง แม้จะระบุ id ของคนอื่น', async () => {
    const { data: all } = await bob.client.from('grades').select().eq('course_id', course.id)
    const { data: targeted } = await bob.client.from('grades').select().eq('student_id', alice.id)

    expect(all?.map((g) => g.student_id)).toEqual([bob.id])
    expect(targeted).toEqual([])
  })

  it('ผู้ปกครองดูข้อมูลบัญชีของคนอื่นไม่ได้', async () => {
    const { data } = await bob.client.from('profiles').select()

    expect(data?.map((p) => p.id)).toEqual([bob.id])
  })

  it('ครูเห็นรายชื่อเฉพาะคอร์สที่ตัวเองสอน', async () => {
    const { data: own } = await teacher.client.from('bookings').select().eq('course_id', course.id)
    const { data: notMine } = await otherTeacher.client.from('bookings').select().eq('course_id', course.id)

    expect(own).toHaveLength(2)
    expect(notMine).toEqual([])
  })

  it('คนที่ยังไม่เข้าสู่ระบบ อ่านข้อมูลและจองไม่ได้', async () => {
    const guest = visitor()

    const courses = await guest.from('course_seats').select()
    const bookings = await guest.from('bookings').select()
    const booked = await guest.rpc('book_seat', { p_course_id: course.id, p_student_name: 'x' })

    expect(courses.data ?? []).toEqual([])
    expect(bookings.data ?? []).toEqual([])
    expect(booked.error).not.toBeNull()
  })
})

describe('ความปลอดภัย: ผู้ปกครองทำสิ่งที่เกินสิทธิ์ไม่ได้', () => {
  it('สร้างการจองตรง ๆ โดยไม่ผ่านการเช็กที่นั่งไม่ได้', async () => {
    const { error } = await bob.client.from('bookings').insert({
      course_id: course.id,
      user_id: bob.id,
      student_name: 'x',
      status: 'paid',
      hold_expires_at: new Date().toISOString(),
    })

    expect(error).not.toBeNull()
  })

  it('แก้สถานะการจองของตัวเองเป็น "จ่ายแล้ว" เองไม่ได้', async () => {
    const { data: mine } = await bob.client.from('bookings').select().eq('user_id', bob.id).single()

    await bob.client.from('bookings').update({ status: 'paid' }).eq('id', mine!.id)

    expect((await getBooking(mine!.id)).status).toBe('held')
  })

  it('เลื่อนสิทธิ์ตัวเองเป็นแอดมินไม่ได้', async () => {
    await bob.client.from('profiles').update({ role: 'admin' }).eq('id', bob.id)

    const { data } = await admin.from('profiles').select('role').eq('id', bob.id).single()
    expect(data?.role).toBe('parent')
  })

  it('เพิ่มคอร์ส แก้จำนวนรับ หรือปิดรับสมัครไม่ได้', async () => {
    const inserted = await bob.client.from('courses').insert({ title: 'x', capacity: 1, price: 0 })
    await bob.client.from('courses').update({ capacity: 999, registration_open: false }).eq('id', course.id)

    const { data } = await admin.from('courses').select().eq('id', course.id).single()
    expect(inserted.error).not.toBeNull()
    expect(data).toMatchObject({ capacity: 5, registration_open: true })
  })

  it('สลับโหมดการจองของระบบไม่ได้', async () => {
    const { data: before } = await admin.from('app_settings').select().single()
    const flipped = before!.booking_mode === 'safe' ? 'unsafe' : 'safe'

    await bob.client.from('app_settings').update({ booking_mode: flipped }).eq('id', true)

    const { data: after } = await admin.from('app_settings').select().single()
    expect(after!.booking_mode).toBe(before!.booking_mode)
  })
})
