import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BookingDto, CourseDto, Me } from '@contract'
import {
  bookSeat,
  confirmPaymentProof,
  currentSession,
  listCourses,
  loadBooking,
  loadMe,
  loadMyBookings,
  loadPaymentSystem,
  signIn,
  signOut,
  submitPaymentProof,
} from '@/app/deps'
import { DomainError } from '@/entities/domain-error'
import { PASSWORD, PNG } from '../e2e/support/env'
import { deleteBookings } from '../e2e/support/service'

// The frontend's real use cases and HTTP gateways against the running API (task up). These check
// the shapes and error codes the UI relies on, not the backend rules (apps/backend/tests/integration).
const SEEDED_COURSE = 'คณิตศาสตร์เสริม ม.1' // capacity 20, from scripts/seed.mjs
const SESSION_KEY = 'seatsure.session'

const created: string[] = []
let courseId = ''
let bookingId = ''

/** A seeded parent who holds no seat in the course yet, so the booking cannot be `already_booked`. */
async function parentWithoutSeat() {
  for (let n = 3; n <= 10; n++) {
    await signIn(`parent${n}@seatsure.test`, PASSWORD)
    const mine = await loadMyBookings()
    if (!mine.some((b) => b.course_id === courseId && (b.status === 'paid' || b.status === 'held'))) return
  }
  throw new Error(`every seeded parent already holds a seat in ${SEEDED_COURSE}`)
}

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (error: unknown) => (error instanceof DomainError ? error.code : `not a DomainError: ${String(error)}`),
  )

describe('frontend use cases against the running API', () => {
  beforeAll(async () => {
    await signIn('parent1@seatsure.test', PASSWORD)
    const course = (await listCourses()).find((c) => c.title === SEEDED_COURSE)
    if (!course) throw new Error(`seeded course ${SEEDED_COURSE} not found: run task up`)
    courseId = course.id
    await signOut()
  })

  afterAll(async () => {
    await deleteBookings(created)
    await signOut()
  })

  it('signIn stores the session the client middleware sends', async () => {
    await parentWithoutSeat()

    expect(currentSession()).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresAt: expect.any(Number),
    })
    expect(JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')).toEqual(currentSession())
  })

  it('loadMe returns the Me shape with the parent role', async () => {
    const me = await loadMe()

    expect(Me.parse(me)).toEqual(me)
    expect(me.role).toBe('parent')
    expect(me.email).toMatch(/^parent\d+@seatsure\.test$/)
  })

  it('listCourses returns approved CourseDto rows including the seeded course', async () => {
    const courses = await listCourses()

    expect(courses.length).toBeGreaterThan(0)
    for (const course of courses) {
      expect(CourseDto.parse(course)).toEqual(course)
      expect(course.approval_status).toBe('approved')
    }
    const seeded = courses.find((c) => c.id === courseId)
    expect(seeded).toBeDefined()
    expect(seeded!.seats_taken).toBeLessThan(seeded!.capacity)
  })

  it('bookSeat on a course with spare seats returns a held BookingDto with the joined course', async () => {
    const booking = await bookSeat({ courseId, studentName: '  นักเรียนทดสอบ cross  ' })
    created.push(booking.id)
    bookingId = booking.id

    expect(BookingDto.parse(booking)).toEqual(booking)
    expect(booking).toMatchObject({
      course_id: courseId,
      status: 'held',
      student_name: 'นักเรียนทดสอบ cross',
      courses: { title: SEEDED_COURSE },
      payments: [],
      payment_proofs: [],
    })
  })

  it('loadMyBookings includes the new booking with its course joined', async () => {
    const mine = await loadMyBookings()
    const booking = mine.find((b) => b.id === bookingId)

    expect(booking).toBeDefined()
    expect(BookingDto.parse(booking)).toEqual(booking)
    expect(booking!.courses).toEqual({ title: SEEDED_COURSE, price: expect.any(Number) })
  })

  it('loadBooking returns the same booking', async () => {
    const booking = await loadBooking(bookingId)

    expect(BookingDto.parse(booking)).toEqual(booking)
    expect(booking).toMatchObject({ id: bookingId, status: 'held' })
  })

  it('submitPaymentProof uploads a PNG File and the booking then lists one proof', async () => {
    await submitPaymentProof({ bookingId, file: new File([PNG], 'proof.png', { type: 'image/png' }) })

    const booking = await loadBooking(bookingId)
    expect(booking.payment_proofs).toHaveLength(1)
    expect(booking.payment_proofs[0]).toMatchObject({ booking_id: bookingId, proof_path: expect.stringMatching(/\.png$/) })
    expect(booking.status).toBe('held')
  })

  it('confirmPaymentProof marks the booking paid with one payment and a receipt number', async () => {
    await confirmPaymentProof(bookingId)

    const booking = await loadBooking(bookingId)
    expect(booking.status).toBe('paid')
    expect(booking.paid_at).not.toBeNull()
    expect(booking.payments).toHaveLength(1)
    expect(booking.payments[0]).toMatchObject({ status: 'succeeded', receipt_no: expect.stringMatching(/^RC-/) })
  })

  it('loadBooking for an unknown id rejects with DomainError booking_not_found', async () => {
    expect(await codeOf(loadBooking(randomUUID()))).toBe('booking_not_found')
  })

  it('loadPaymentSystem as a parent rejects with DomainError forbidden', async () => {
    expect(await codeOf(loadPaymentSystem())).toBe('forbidden')
  })

  it('a garbled access token is refreshed by the middleware and the call still succeeds', async () => {
    const before = currentSession()!
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...before, accessToken: 'garbage.not.a.jwt' }))

    const me = await loadMe()

    expect(me.role).toBe('parent')
    const after = currentSession()!
    expect(after.accessToken).not.toBe('garbage.not.a.jwt')
    expect(after.refreshToken).not.toBe(before.refreshToken) // rotated by the refresh
  })

  it('after signOut the session is gone and calls reject with not_authenticated', async () => {
    await signOut()

    expect(currentSession()).toBeNull()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(await codeOf(loadMe())).toBe('not_authenticated')
  })
})
