import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp, type AppDeps } from '../../../src/app'
import { BookingDto, RosterRowDto } from '../../../src/adaptor/http/contract'
import { endpoints } from '../../../src/adaptor/http/endpoints'
import { actor, bookingRow, bookingsAuthProvider, COURSE_FULL, COURSE_T1, COURSE_T2, fakeBookingRepository, type ActorName } from '../bookings-fake-repository'

function setup(rows = [bookingRow({ id: 'b1' })]) {
  const bookingRepository = fakeBookingRepository(rows)
  // Only the bookings group is exercised; the other groups' ports are not touched.
  const deps = { frontendOrigin: 'http://localhost:5173', authProvider: bookingsAuthProvider(), bookingRepository } as unknown as AppDeps
  return { app: createApp(deps), repo: bookingRepository }
}

const as = (name: ActorName) => ({ Authorization: `Bearer ${actor(name).token}` })

describe('POST /bookings', () => {
  it('books a seat: 201 with the booking DTO', async () => {
    const { app, repo } = setup([])
    const res = await request(app).post('/bookings').set(as('parent')).send({ courseId: COURSE_T1, studentName: 'Mali' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(BookingDto.parse(res.body.data)).toMatchObject({ course_id: COURSE_T1, student_name: 'Mali', user_id: 'u-parent' })
    expect(repo.calls.bookSeat[0]!.token).toBe('token-u-parent')
  })

  it.each(['', '   '])('student name %j -> 400 student_name_required', async (studentName) => {
    const { app } = setup([])
    const res = await request(app).post('/bookings').set(as('parent')).send({ courseId: COURSE_T1, studentName })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, message: 'student_name_required' })
  })

  it('courseId not a uuid -> 400 validation error on courseId', async () => {
    const { app } = setup([])
    const res = await request(app).post('/bookings').set(as('parent')).send({ courseId: 'x', studentName: 'Mali' })
    expect(res.status).toBe(400)
    expect(res.body.errors).toEqual([{ field: 'courseId', message: expect.any(String) }])
  })

  it('a database refusal -> 400 with its code', async () => {
    const { app } = setup([])
    const res = await request(app).post('/bookings').set(as('parent')).send({ courseId: COURSE_FULL, studentName: 'Mali' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, message: 'course_full' })
  })

  it('without a token -> 401 not_authenticated', async () => {
    const { app } = setup([])
    const res = await request(app).post('/bookings').send({ courseId: COURSE_T1, studentName: 'Mali' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, message: 'not_authenticated' })
  })
})

describe('GET /bookings/mine', () => {
  it('returns only the caller’s bookings', async () => {
    const { app } = setup([bookingRow({ id: 'mine' }), bookingRow({ id: 'theirs', user_id: 'u-parent2' })])
    const res = await request(app).get('/bookings/mine').set(as('parent'))
    expect(res.status).toBe(200)
    expect(res.body.data.map((b: BookingDto) => b.id)).toEqual(['mine'])
    BookingDto.array().parse(res.body.data)
  })
})

describe('GET /bookings/active', () => {
  it('is not swallowed by /bookings/:id and returns held/paid rows of the caller', async () => {
    const { app } = setup([bookingRow({ id: 'a1' }), bookingRow({ id: 'a2', status: 'expired' })])
    const res = await request(app).get('/bookings/active').set(as('parent'))
    expect(res.status).toBe(200)
    expect(res.body.data.map((b: { id: string }) => b.id)).toEqual(['a1'])
  })
})

describe('GET /bookings/:id', () => {
  it('owner -> 200 with the booking', async () => {
    const { app } = setup()
    const res = await request(app).get('/bookings/b1').set(as('parent'))
    expect(res.status).toBe(200)
    expect(BookingDto.parse(res.body.data).id).toBe('b1')
  })

  it('someone else -> 404 booking_not_found', async () => {
    const { app } = setup()
    const res = await request(app).get('/bookings/b1').set(as('parent2'))
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ success: false, message: 'booking_not_found' })
  })
})

describe('GET /courses/:id/roster', () => {
  const rows = [bookingRow({ id: 'r1', course_id: COURSE_T1 })]

  it('course teacher -> 200, proof URLs null', async () => {
    const { app } = setup(rows.slice())
    const res = await request(app).get(`/courses/${COURSE_T1}/roster`).set(as('teacher'))
    expect(res.status).toBe(200)
    const roster = RosterRowDto.array().parse(res.body.data)
    expect(roster[0]!.payment_proofs[0]!.signed_url).toBeNull()
  })

  it('another teacher -> 403 forbidden, no data', async () => {
    const { app } = setup(rows.slice())
    const res = await request(app).get(`/courses/${COURSE_T1}/roster`).set(as('teacher2'))
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ success: false, message: 'forbidden' })
  })

  it('parent -> 403 forbidden', async () => {
    const { app } = setup(rows.slice())
    const res = await request(app).get(`/courses/${COURSE_T1}/roster`).set(as('parent'))
    expect(res.status).toBe(403)
  })

  it('admin01 -> signed proof URLs', async () => {
    const { app } = setup(rows.slice())
    const res = await request(app).get(`/courses/${COURSE_T1}/roster`).set(as('admin01'))
    expect(res.body.data[0].payment_proofs[0].signed_url).toBe('https://signed/r1')
  })

  it('unknown course -> 404 course_not_found', async () => {
    const { app } = setup(rows.slice())
    const res = await request(app).get(`/courses/${COURSE_T2.replace('2222', '9999')}/roster`).set(as('admin'))
    expect(res.status).toBe(404)
    expect(res.body.message).toBe('course_not_found')
  })
})

describe('bookings endpoint docs', () => {
  const docs = endpoints.filter((e) => e.tag === 'Bookings')

  it.each([
    ['post', '/bookings'],
    ['get', '/bookings/mine'],
    ['get', '/bookings/active'],
    ['get', '/bookings/:id'],
    ['get', '/courses/:id/roster'],
  ])('%s %s is documented', (method, path) => {
    const doc = docs.find((e) => e.method === method && e.path === path)
    expect(doc, `${method} ${path}`).toBeDefined()
    expect(doc!.operationId).toMatch(/^[a-z][A-Za-z]+$/)
    expect(doc!.description).toBeTruthy()
  })

  it('bookings operationIds are unique across the API', () => {
    const ids = docs.map((e) => e.operationId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(endpoints.filter((e) => e.operationId === id)).toHaveLength(1)
  })

  it('every bookings operation names its errors with a status', () => {
    for (const doc of docs) for (const error of doc.errors) expect(error.status).toBeGreaterThanOrEqual(400)
  })
})
