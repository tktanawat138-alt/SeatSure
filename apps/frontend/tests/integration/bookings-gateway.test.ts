import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { BookSeatBody, type ActiveBookingDto, type BookingDto, type RosterRowDto, type Session } from '@contract'
import type { DomainError } from '@/entities/domain-error'
import type { ActiveBooking } from '@/interfaces/bookings-gateway'
import { createApiClient } from '@/adaptor/http/client'
import { createBookingsGateway } from '@/adaptor/http/bookings-gateway'
import { createSessionStore } from '@/adaptor/http/session-store'
import { createBookSeat } from '@/use-cases/book-seat'
import { createLoadActiveBookings } from '@/use-cases/active-bookings'
import { createLoadBooking } from '@/use-cases/load-booking'
import { createLoadCourseRoster } from '@/use-cases/load-course-roster'
import { createLoadMyBookings } from '@/use-cases/load-my-bookings'
import { api, authorization, stubNetwork } from './stub-network'

afterEach(() => vi.unstubAllGlobals())

const BASE = 'http://api.test'
const COURSE = '3f2b8a52-6f0e-4c53-9d6e-0a1b2c3d4e5f'
const session: Session = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 2_000_000_000 }
const ok = (data: unknown, status = 200) => ({ status, body: { success: true, data } })
const fail = (status: number, message: string) => ({ status, body: { success: false, message } })
const booking = (id: string) =>
  ({
    id,
    status: 'held',
    courses: { title: 'Piano', price: 1500 },
    payments: [],
    payment_proofs: [{ id: `p-${id}`, booking_id: id, proof_path: `u/${id}.png`, submitted_at: '2026-10-10T10:00:00+00:00' }],
  }) as unknown as BookingDto

function setup() {
  const items = new Map<string, string>()
  const store = createSessionStore(() => ({
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, v),
    removeItem: (k) => void items.delete(k),
  }))
  store.set(session)
  return createBookingsGateway(createApiClient({ baseUrl: BASE, store }))
}
const body = (init?: RequestInit) => JSON.parse(String(init?.body))
const rejection = (promise: Promise<unknown>) => promise.then(() => null, (e: unknown) => e as DomainError)

describe('bookingsGateway', () => {
  it('book posts {courseId, studentName} to /bookings with the bearer token and returns the booking', async () => {
    const calls = stubNetwork(api('POST', '/bookings', ok(booking('b1'), 201)))

    const result = await createBookSeat(setup())({ courseId: COURSE, studentName: 'Mali' })

    expect(result.id).toBe('b1')
    expect(body(calls[0]!.init)).toEqual({ courseId: COURSE, studentName: 'Mali' })
    expect(BookSeatBody.safeParse(body(calls[0]!.init)).success).toBe(true)
    expect(authorization(calls[0]!.init)).toBe('Bearer access-1')
  })

  it('book with a blank student name rejects student_name_required without a request', async () => {
    const calls = stubNetwork()
    const error = await rejection(createBookSeat(setup())({ courseId: COURSE, studentName: '   ' }))
    expect(error?.code).toBe('student_name_required')
    expect(calls).toHaveLength(0)
  })

  it('book surfaces the API error code (course_full)', async () => {
    stubNetwork(api('POST', '/bookings', fail(400, 'course_full')))
    const error = await rejection(createBookSeat(setup())({ courseId: COURSE, studentName: 'Mali' }))
    expect(error?.code).toBe('course_full')
  })

  it('load my bookings gets /bookings/mine and merges nothing client-side (proofs come joined)', async () => {
    const reply = [booking('b1'), booking('b2')]
    const calls = stubNetwork(api('GET', '/bookings/mine', ok(reply)))

    const bookings = await createLoadMyBookings(setup())()

    expect(bookings).toEqual(reply)
    expect(calls).toHaveLength(1)
  })

  it('load my bookings rejects with the API code', async () => {
    stubNetwork(api('GET', '/bookings/mine', fail(500, 'Internal server error')))
    expect((await rejection(createLoadMyBookings(setup())()))?.code).toBe('Internal server error')
  })

  it('load booking gets /bookings/:id (encoded) for the receipt', async () => {
    const calls = stubNetwork(api('GET', '/bookings/b%2F1', ok(booking('b/1'))))
    expect((await createLoadBooking(setup())('b/1')).id).toBe('b/1')
    expect(calls[0]!.url.pathname).toBe('/bookings/b%2F1')
  })

  it('load booking of someone else rejects booking_not_found', async () => {
    stubNetwork(api('GET', '/bookings/b1', fail(404, 'booking_not_found')))
    expect((await rejection(createLoadBooking(setup())('b1')))?.code).toBe('booking_not_found')
  })

  it('active bookings get /bookings/active', async () => {
    const rows = [{ id: 'a1', course_id: COURSE, status: 'paid' }] as ActiveBookingDto[]
    stubNetwork(api('GET', '/bookings/active', ok(rows)))
    expect(await createLoadActiveBookings(setup())()).toEqual(rows)
  })

  it('course roster gets /courses/:id/roster', async () => {
    const rows = [{ id: 'r1', payment_proofs: [] }] as unknown as RosterRowDto[]
    const calls = stubNetwork(api('GET', `/courses/${COURSE}/roster`, ok(rows)))
    expect(await createLoadCourseRoster(setup())(COURSE)).toEqual(rows)
    expect(calls[0]!.init?.method).toBe('GET')
  })

  it('course roster of another teacher rejects forbidden', async () => {
    stubNetwork(api('GET', `/courses/${COURSE}/roster`, fail(403, 'forbidden')))
    expect((await rejection(createLoadCourseRoster(setup())(COURSE)))?.code).toBe('forbidden')
  })

  it('ActiveBooking equals the contract ActiveBookingDto', () => {
    expectTypeOf<ActiveBooking>().toEqualTypeOf<ActiveBookingDto>()
  })
})
