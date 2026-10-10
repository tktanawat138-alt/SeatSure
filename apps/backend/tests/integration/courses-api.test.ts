import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { createSupabaseAuthProvider } from '../../src/adaptor/supabase/auth-provider'
import { wireCourses } from '../../src/adaptor/supabase/courses-wiring'
import { admin, attachProof, cleanup, confirmPayment, createCourse, createUser, mustBook, type TestUser } from './helpers'

// The courses API over HTTP (supertest) with the real Supabase adaptors.
const config = {
  url: process.env.VITE_SUPABASE_URL!,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
}
const app = createApp({
  frontendOrigin: 'http://localhost:5173',
  authProvider: createSupabaseAuthProvider(config),
  ...wireCourses(config),
})

const createdViaApi: string[] = []
afterAll(async () => {
  if (createdViaApi.length > 0) await admin.from('courses').delete().in('id', createdViaApi)
  const { data: courses } = await admin.from('courses').select('id').like('title', 'API test %')
  const ids = (courses ?? []).map((c) => c.id)
  if (ids.length > 0) await admin.from('refund_reports').delete().in('course_id', ids)
  await cleanup()
})

const tokenOf = async (user: TestUser) => (await user.client.auth.getSession()).data.session!.access_token
const get = async (user: TestUser | string, path: string) =>
  request(app).get(path).set('Authorization', `Bearer ${typeof user === 'string' ? user : await tokenOf(user)}`)
const send = async (method: 'post' | 'patch', user: TestUser | string, path: string, body: object) =>
  request(app)[method](path).set('Authorization', `Bearer ${typeof user === 'string' ? user : await tokenOf(user)}`).send(body)

async function loginAsAdmin01() {
  const res = await request(app).post('/auth/login').send({ email: 'admin01@seatsure.test', password: 'seatsure123' })
  expect(res.status).toBe(200)
  return res.body.data.accessToken as string
}

const ids = (res: { body: { data: { id: string }[] } }) => res.body.data.map((c) => c.id)
const schedule = { startsAt: '2026-12-01T09:00:00.000Z', endsAt: '2026-12-01T11:00:00.000Z' }
const newCourse = { title: `API test ${Date.now()}`, description: 'desc', capacity: 5, price: 700, ...schedule }

describe('GET /courses', () => {
  it('as parent returns exactly the approved, non-cancelled courses', async () => {
    const parent = await createUser()
    const res = await get(parent, '/courses')
    expect(res.status).toBe(200)

    const { data } = await admin.from('course_seats').select('id').is('cancelled_at', null)
    expect(ids(res).sort()).toEqual((data ?? []).map((c) => c.id).sort())
    expect(res.body.data[0]).toMatchObject({ seats_taken: expect.any(Number), approval_status: 'approved' })
  })

  it('without a token is 401', async () => {
    expect((await request(app).get('/courses')).status).toBe(401)
  })
})

describe('course lifecycle', () => {
  it('teacher submits a course: pending, hidden from parents, listed for the teacher; admin01 approval shows it', async () => {
    const teacher = await createUser('teacher')
    const parent = await createUser()

    const created = await send('post', teacher, '/courses', newCourse)
    expect(created.status).toBe(200)
    const id = created.body.data.id as string
    createdViaApi.push(id)
    expect(created.body.data).toMatchObject({
      title: newCourse.title,
      teacher_id: teacher.id,
      approval_status: 'pending',
      registration_open: false,
      seats_taken: 0,
    })
    expect(Date.parse(created.body.data.starts_at)).toBe(Date.parse(newCourse.startsAt))

    expect(ids(await get(parent, '/courses'))).not.toContain(id)
    expect(ids(await get(teacher, '/courses?mine=true'))).toContain(id)

    const admin01 = await loginAsAdmin01()
    expect(ids(await get(admin01, '/courses?pending=true'))).toContain(id)

    const approved = await send('post', admin01, `/courses/${id}/approval`, { approved: true })
    expect(approved.status).toBe(200)
    expect(approved.body.data).toMatchObject({ approval_status: 'approved', registration_open: true })
    expect(ids(await get(parent, '/courses'))).toContain(id)
    expect(ids(await get(admin01, '/courses?pending=true'))).not.toContain(id)
  })

  it('admin01 rejection keeps the course hidden from parents', async () => {
    const teacher = await createUser('teacher')
    const parent = await createUser()
    const created = await send('post', teacher, '/courses', { ...newCourse, title: `${newCourse.title} rejected` })
    const id = created.body.data.id as string
    createdViaApi.push(id)

    const res = await send('post', await loginAsAdmin01(), `/courses/${id}/approval`, { approved: false })
    expect(res.body.data).toMatchObject({ approval_status: 'rejected', registration_open: false })
    expect(ids(await get(parent, '/courses'))).not.toContain(id)
    expect(ids(await get(teacher, '/courses?mine=true'))).toContain(id)
  })

  it('an admin who is not admin01 cannot approve', async () => {
    const teacher = await createUser('teacher')
    const otherAdmin = await createUser('admin')
    const created = await send('post', teacher, '/courses', newCourse)
    createdViaApi.push(created.body.data.id)

    const res = await send('post', otherAdmin, `/courses/${created.body.data.id}/approval`, { approved: true })
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ success: false, message: 'admin01_required' })
  })

  it('a parent cannot create a course', async () => {
    const res = await send('post', await createUser(), '/courses', newCourse)
    expect(res.status).toBe(403)
  })
})

describe('PATCH /courses/:id', () => {
  it('admin changes capacity and closes registration', async () => {
    const course = await createCourse({ capacity: 4 })
    const res = await send('patch', await createUser('admin'), `/courses/${course.id}`, { capacity: 6, registrationOpen: false })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ capacity: 6, registration_open: false })
  })

  it('capacity below the booked seats is refused with capacity_below_booked', async () => {
    const course = await createCourse({ capacity: 3 })
    const [one, two] = [await createUser(), await createUser()]
    await mustBook(one, course.id)
    await mustBook(two, course.id)

    const res = await send('patch', await createUser('admin'), `/courses/${course.id}`, { capacity: 1 })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, message: 'capacity_below_booked' })
  })

  it('teacher updates the schedule of their own course only', async () => {
    const teacher = await createUser('teacher')
    const other = await createUser('teacher')
    const course = await createCourse({ capacity: 4, teacherId: teacher.id })

    const mine = await send('patch', teacher, `/courses/${course.id}`, schedule)
    expect(mine.status).toBe(200)
    expect(Date.parse(mine.body.data.starts_at)).toBe(Date.parse(schedule.startsAt))
    expect(Date.parse(mine.body.data.ends_at)).toBe(Date.parse(schedule.endsAt))

    const theirs = await send('patch', other, `/courses/${course.id}`, schedule)
    expect(theirs.status).toBe(403)
    expect(theirs.body).toEqual({ success: false, message: 'forbidden' })
  })

  it('a teacher cannot change capacity', async () => {
    const teacher = await createUser('teacher')
    const course = await createCourse({ capacity: 4, teacherId: teacher.id })
    expect((await send('patch', teacher, `/courses/${course.id}`, { capacity: 9 })).status).toBe(403)
  })

  it('an unknown course is 404 course_not_found', async () => {
    const res = await send('patch', await createUser('admin'), '/courses/00000000-0000-4000-8000-000000000000', { capacity: 3 })
    expect(res.status).toBe(404)
    expect(res.body.message).toBe('course_not_found')
  })
})

describe('POST /courses/:id/cancel', () => {
  it('returns the refund count, writes refund_reports, and hides the course from parents', async () => {
    const course = await createCourse({ capacity: 3 })
    const paid = await createUser()
    const held = await createUser()
    const booking = await mustBook(paid, course.id)
    await attachProof(paid, booking.id)
    expect((await confirmPayment(paid, booking.id)).error).toBeNull()
    await mustBook(held, course.id)

    const res = await send('post', await createUser('admin'), `/courses/${course.id}/cancel`, { reason: 'ฝนตก' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: 1 })

    const { data: reports } = await admin.from('refund_reports').select().eq('course_id', course.id)
    expect(reports).toHaveLength(1)
    expect(reports![0]).toMatchObject({ cancellation_reason: 'ฝนตก', booking_id: booking.id })
    expect(ids(await get(paid, '/courses'))).not.toContain(course.id)

    const again = await send('post', await createUser('admin'), `/courses/${course.id}/cancel`, { reason: 'อีกครั้ง' })
    expect(again.status).toBe(400)
    expect(again.body.message).toBe('course_already_cancelled')
  })

  it('a cancelled course cannot be reopened', async () => {
    const course = await createCourse({ capacity: 3 })
    const adminUser = await createUser('admin')
    await send('post', adminUser, `/courses/${course.id}/cancel`, { reason: 'x' })
    const res = await send('patch', adminUser, `/courses/${course.id}`, { registrationOpen: true })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('course_cancelled')
  })

  it('a teacher cannot cancel', async () => {
    const course = await createCourse({ capacity: 3 })
    const res = await send('post', await createUser('teacher'), `/courses/${course.id}/cancel`, { reason: 'x' })
    expect(res.status).toBe(403)
  })
})
