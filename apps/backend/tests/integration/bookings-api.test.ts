import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type AppDeps } from '../../src/app'
import { ActiveBookingDto, BookingDto, RosterRowDto } from '../../src/adaptor/http/contract'
import { createSupabaseAuthProvider } from '../../src/adaptor/supabase/auth-provider'
import { wireBookings } from '../../src/adaptor/supabase/bookings-wiring'
import { admin, attachProof, cleanup, createCourse, createUser, createUsers, seatsTaken, type TestUser } from './helpers'

// The bookings API over HTTP (supertest) with the real Supabase adaptors.
const supabase = {
  url: process.env.VITE_SUPABASE_URL!,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
}
const app = createApp({
  frontendOrigin: 'http://localhost:5173',
  authProvider: createSupabaseAuthProvider(supabase),
  ...wireBookings(supabase),
} as AppDeps)

afterAll(cleanup)

async function tokenOf(user: TestUser) {
  const { data } = await user.client.auth.getSession()
  return data.session!.access_token
}

const post = async (user: TestUser, courseId: string, studentName = 'นักเรียนทดสอบ') =>
  request(app).post('/bookings').set('Authorization', `Bearer ${await tokenOf(user)}`).send({ courseId, studentName })

const get = async (user: TestUser | string, path: string) =>
  request(app).get(path).set('Authorization', `Bearer ${typeof user === 'string' ? user : await tokenOf(user)}`)

async function bookingsOf(courseId: string) {
  const { data, error } = await admin.from('bookings').select('id, user_id, status').eq('course_id', courseId)
  if (error) throw error
  return data
}

describe('POST /bookings against real Supabase', () => {
  it('20 parents book the last seat at once: exactly one 201, the rest course_full', async () => {
    const course = await createCourse({ capacity: 1 })
    const parents = await createUsers(20)

    const results = await Promise.all(parents.map((parent) => post(parent, course.id)))

    expect(results.filter((r) => r.status === 201), 'จำนวนคนที่จองสำเร็จ').toHaveLength(1)
    const refusals = results.filter((r) => r.status !== 201)
    expect(new Set(refusals.map((r) => r.status))).toEqual(new Set([400]))
    expect(new Set(refusals.map((r) => r.body.message))).toEqual(new Set(['course_full']))
    expect(await seatsTaken(course.id)).toBe(1)
  })

  it('returns the new booking as a held BookingDto with the course joined', async () => {
    const course = await createCourse({ capacity: 5 })
    const parent = await createUser()

    const res = await post(parent, course.id, '  ด.ญ. มะลิ  ')

    expect(res.status).toBe(201)
    const booking = BookingDto.parse(res.body.data)
    expect(booking).toMatchObject({ course_id: course.id, user_id: parent.id, status: 'held', student_name: 'ด.ญ. มะลิ', payments: [], payment_proofs: [] })
    expect(booking.courses).toEqual({ title: course.title, price: 1500 })
  })

  it('a second booking of the same course by the same parent -> already_booked', async () => {
    const course = await createCourse({ capacity: 5 })
    const parent = await createUser()
    expect((await post(parent, course.id)).status).toBe(201)

    const res = await post(parent, course.id)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, message: 'already_booked' })
  })

  it('a double-click (two parallel requests by one parent) makes one booking', async () => {
    const course = await createCourse({ capacity: 5 })
    const parent = await createUser()

    const results = await Promise.all([post(parent, course.id), post(parent, course.id)])

    expect(results.map((r) => r.status).sort()).toEqual([201, 400])
    expect(results.find((r) => r.status === 400)!.body.message).toBe('already_booked')
    expect(await bookingsOf(course.id)).toHaveLength(1)
  })

  it('registration closed -> registration_closed, no seat taken', async () => {
    const course = await createCourse({ capacity: 5, registrationOpen: false })
    const parent = await createUser()

    const res = await post(parent, course.id)

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, message: 'registration_closed' })
    expect(await seatsTaken(course.id)).toBe(0)
  })

  it('an empty student name -> 400 student_name_required, nothing stored', async () => {
    const course = await createCourse({ capacity: 5 })
    const parent = await createUser()

    const res = await post(parent, course.id, '   ')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, message: 'student_name_required' })
    expect(await bookingsOf(course.id)).toHaveLength(0)
  })
})

describe('reading bookings against real Supabase', () => {
  let teacher: TestUser
  let otherTeacher: TestUser
  let first: TestUser
  let second: TestUser
  let courseId: string
  let otherCourseId: string
  let firstBookingId: string

  beforeAll(async () => {
    ;[teacher, otherTeacher] = await createUsers(2, 'teacher')
    ;[first, second] = await createUsers(2)
    courseId = (await createCourse({ capacity: 5, teacherId: teacher.id })).id
    otherCourseId = (await createCourse({ capacity: 5, teacherId: otherTeacher.id })).id
    firstBookingId = (await post(first, courseId)).body.data.id
    await post(second, courseId)
    await post(second, otherCourseId)
    await attachProof(first, firstBookingId)
  })

  it('GET /bookings/mine returns only the caller’s bookings, with proofs joined', async () => {
    const res = await get(first, '/bookings/mine')

    expect(res.status).toBe(200)
    const mine = BookingDto.array().parse(res.body.data)
    expect(mine.map((b) => b.user_id)).toEqual([first.id])
    expect(mine[0]!.payment_proofs).toHaveLength(1)
    expect((await get(second, '/bookings/mine')).body.data).toHaveLength(2)
  })

  it('GET /bookings/:id: the owner gets it, anyone else and a malformed id get booking_not_found', async () => {
    const own = await get(first, `/bookings/${firstBookingId}`)
    expect(own.status).toBe(200)
    expect(BookingDto.parse(own.body.data).id).toBe(firstBookingId)

    for (const res of [await get(second, `/bookings/${firstBookingId}`), await get(teacher, `/bookings/${firstBookingId}`), await get(first, '/bookings/not-a-uuid')]) {
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ success: false, message: 'booking_not_found' })
    }
  })

  it('GET /bookings/active: parent sees own held/paid rows, teacher sees their course only', async () => {
    const parentRows = ActiveBookingDto.array().parse((await get(second, '/bookings/active')).body.data)
    expect(parentRows.every((b) => b.user_id === second.id)).toBe(true)
    expect(parentRows.map((b) => b.course_id).sort()).toEqual([courseId, otherCourseId].sort())

    const teacherRows = ActiveBookingDto.array().parse((await get(teacher, '/bookings/active')).body.data)
    expect(new Set(teacherRows.map((b) => b.course_id))).toEqual(new Set([courseId]))
    expect(teacherRows).toHaveLength(2)
  })

  it('roster of another teacher’s course -> 403 forbidden, no data', async () => {
    const res = await get(otherTeacher, `/courses/${courseId}/roster`)

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ success: false, message: 'forbidden' })
  })

  it('roster for the course teacher: booking rows and student names only (old RLS parity)', async () => {
    const res = await get(teacher, `/courses/${courseId}/roster`)

    expect(res.status).toBe(200)
    const roster = RosterRowDto.array().parse(res.body.data)
    expect(roster).toHaveLength(2)
    for (const row of roster) {
      expect(row.student_name).toBe('นักเรียนทดสอบ')
      expect(row.profiles).toEqual({ full_name: '' })
      expect(row.payments).toEqual([])
      expect(row.payment_proofs).toEqual([])
    }
  })

  it('roster for an admin who is not admin01: parent names and payments, no proofs', async () => {
    const staff = await createUser('admin')

    const res = await get(staff, `/courses/${courseId}/roster`)

    expect(res.status).toBe(200)
    const roster = RosterRowDto.array().parse(res.body.data)
    expect(roster).toHaveLength(2)
    expect(roster.every((r) => /^Test parent/.test(r.profiles.full_name))).toBe(true)
    expect(roster.every((r) => r.payment_proofs.length === 0)).toBe(true)
  })

  it('roster for admin01 carries a working signed URL of the proof image', async () => {
    const login = await request(app).post('/auth/login').send({ email: 'admin01@seatsure.test', password: 'seatsure123' })
    expect(login.status).toBe(200)

    const res = await get(login.body.data.accessToken, `/courses/${courseId}/roster`)

    expect(res.status).toBe(200)
    const roster = RosterRowDto.array().parse(res.body.data)
    expect(roster.find((r) => r.id === firstBookingId)!.profiles.full_name).toMatch(/^Test parent/)
    const proofs = roster.flatMap((r) => r.payment_proofs)
    expect(proofs).toHaveLength(1)
    const url = proofs[0]!.signed_url
    expect(url).toEqual(expect.any(String))
    expect((await fetch(url!)).status).toBe(200)
  })

  it('roster as a parent -> 403 forbidden', async () => {
    const res = await get(first, `/courses/${courseId}/roster`)
    expect(res.status).toBe(403)
  })
})
