import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../../src/app'
import { accounts, fakeAuthProvider, tokenFor } from './fake-auth-provider'
import { course, fakeCourseRepository } from '../courses-fake-repository'

// The fake auth accounts own ids u-teacher / u-parent / u-admin; admin01 is added for approval tests.
const ADMIN01 = { id: 'u-admin01', email: 'admin01@seatsure.test', password: 'pw', fullName: 'Admin 01', role: 'admin' as const }
accounts.push(ADMIN01)

const ID = '11111111-1111-4111-8111-111111111111'
const base = course({ id: ID, teacher_id: 'u-teacher' })
const pending = course({ id: '22222222-2222-4222-8222-222222222222', teacher_id: 'u-teacher', approval_status: 'pending', registration_open: false })

function setup() {
  const courseRepository = fakeCourseRepository([base, pending])
  const app = createApp({ frontendOrigin: 'http://localhost:5173', authProvider: fakeAuthProvider(), courseRepository })
  return { app, courseRepository }
}
const as = (id: string) => ({ Authorization: `Bearer ${tokenFor(id)}` })
const schedule = { startsAt: '2026-12-01T09:00:00.000Z', endsAt: '2026-12-01T10:00:00.000Z' }

describe('GET /courses', () => {
  it('without a token returns 401 not_authenticated', async () => {
    const res = await request(setup().app).get('/courses')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'not_authenticated' })
  })

  it('parent gets approved courses in the envelope', async () => {
    const res = await request(setup().app).get('/courses').set(as('u-parent'))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: [base] })
  })

  it('teacher with mine=true gets their own courses including pending', async () => {
    const res = await request(setup().app).get('/courses?mine=true').set(as('u-teacher'))
    expect(res.body.data.map((c: { id: string }) => c.id).sort()).toEqual([base.id, pending.id].sort())
  })

  it('admin with pending=true gets the approval queue', async () => {
    const res = await request(setup().app).get('/courses?pending=true').set(as('u-admin'))
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([pending.id])
  })

  it('parent with pending=true is 403 forbidden', async () => {
    const res = await request(setup().app).get('/courses?pending=true').set(as('u-parent'))
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ success: false, message: 'forbidden' })
  })

  it('an invalid pending value is 400', async () => {
    const res = await request(setup().app).get('/courses?pending=maybe').set(as('u-admin'))
    expect(res.status).toBe(400)
  })
})

describe('POST /courses', () => {
  const valid = { title: 'Physics', description: '', capacity: 20, price: 900, ...schedule }

  it('teacher creates a pending course', async () => {
    const res = await request(setup().app).post('/courses').set(as('u-teacher')).send(valid)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ title: 'Physics', approval_status: 'pending', registration_open: false, teacher_id: 'u-teacher' })
  })

  it('parent is 403 forbidden', async () => {
    const res = await request(setup().app).post('/courses').set(as('u-parent')).send(valid)
    expect(res.status).toBe(403)
  })

  it('invalid body is 400 with field errors', async () => {
    const res = await request(setup().app).post('/courses').set(as('u-teacher')).send({ ...valid, capacity: 0, endsAt: valid.startsAt })
    expect(res.status).toBe(400)
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['capacity', 'endsAt'])
  })
})

describe('PATCH /courses/:id', () => {
  it('admin updates capacity', async () => {
    const res = await request(setup().app).patch(`/courses/${ID}`).set(as('u-admin')).send({ capacity: 4 })
    expect(res.status).toBe(200)
    expect(res.body.data.capacity).toBe(4)
  })

  it('teacher updates the schedule of their course', async () => {
    const res = await request(setup().app).patch(`/courses/${ID}`).set(as('u-teacher')).send(schedule)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ starts_at: schedule.startsAt, ends_at: schedule.endsAt })
  })

  it('a DB capacity_below_booked is 400 with that code', async () => {
    const { app, courseRepository } = setup()
    courseRepository.failWith('capacity_below_booked')
    const res = await request(app).patch(`/courses/${ID}`).set(as('u-admin')).send({ capacity: 1 })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, message: 'capacity_below_booked' })
  })

  it('an empty change is 400', async () => {
    const res = await request(setup().app).patch(`/courses/${ID}`).set(as('u-admin')).send({})
    expect(res.status).toBe(400)
  })

  it('an unknown course is 404 course_not_found', async () => {
    const res = await request(setup().app).patch('/courses/33333333-3333-4333-8333-333333333333').set(as('u-admin')).send({ capacity: 4 })
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ success: false, message: 'course_not_found' })
  })

  it('an id that is not a uuid is 404 course_not_found', async () => {
    const res = await request(setup().app).patch('/courses/not-a-uuid').set(as('u-admin')).send({ capacity: 4 })
    expect(res.status).toBe(404)
  })

  it('parent is 403 forbidden', async () => {
    const res = await request(setup().app).patch(`/courses/${ID}`).set(as('u-parent')).send({ capacity: 4 })
    expect(res.status).toBe(403)
  })
})

describe('POST /courses/:id/approval', () => {
  it('admin01 approves a pending course', async () => {
    const res = await request(setup().app).post(`/courses/${pending.id}/approval`).set(as('u-admin01')).send({ approved: true })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ approval_status: 'approved', registration_open: true })
  })

  it('another admin gets 403 admin01_required', async () => {
    const res = await request(setup().app).post(`/courses/${pending.id}/approval`).set(as('u-admin')).send({ approved: true })
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ success: false, message: 'admin01_required' })
  })

  it('a teacher gets 403 forbidden', async () => {
    const res = await request(setup().app).post(`/courses/${pending.id}/approval`).set(as('u-teacher')).send({ approved: true })
    expect(res.status).toBe(403)
  })

  it('a body without approved is 400', async () => {
    const res = await request(setup().app).post(`/courses/${pending.id}/approval`).set(as('u-admin01')).send({})
    expect(res.status).toBe(400)
  })
})

describe('POST /courses/:id/cancel', () => {
  it('admin cancels and receives the refund count', async () => {
    const { app, courseRepository } = setup()
    courseRepository.refundCount = 2
    const res = await request(app).post(`/courses/${ID}/cancel`).set(as('u-admin')).send({ reason: 'ฝนตก' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: 2 })
  })

  it('teacher is 403 forbidden', async () => {
    const res = await request(setup().app).post(`/courses/${ID}/cancel`).set(as('u-teacher')).send({ reason: 'x' })
    expect(res.status).toBe(403)
  })

  it('a blank reason is 400', async () => {
    const res = await request(setup().app).post(`/courses/${ID}/cancel`).set(as('u-admin')).send({ reason: '  ' })
    expect(res.status).toBe(400)
  })
})
