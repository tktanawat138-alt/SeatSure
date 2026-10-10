import { describe, expect, it } from 'vitest'
import { canViewProofImages, holdIsLive, holdsSeat } from '../../../src/entities/booking'
import { createBookings } from '../../../src/use-cases/bookings'
import { actor, bookingRow, COURSE_FULL, COURSE_T1, COURSE_T2, fakeBookingRepository } from '../bookings-fake-repository'

const HOUR = 3_600_000
const now = Date.now()
const at = (offsetMs: number) => new Date(now + offsetMs).toISOString()

function setup(rows = [bookingRow()]) {
  const repo = fakeBookingRepository(rows)
  return { repo, bookings: createBookings(repo) }
}

describe('booking entity', () => {
  it.each([
    ['paid', at(-HOUR), true],
    ['held', at(HOUR), true],
    ['held', at(-HOUR), false],
    ['cancelled', at(HOUR), false],
    ['expired', at(HOUR), false],
  ] as const)('holdsSeat %s with hold until %s -> %s (marks the course card as booked)', (status, until, expected) => {
    expect(holdsSeat({ status, hold_expires_at: until }, now)).toBe(expected)
  })

  it('holdIsLive paid booking -> false (nothing left to pay)', () => {
    expect(holdIsLive({ status: 'paid', hold_expires_at: at(HOUR) }, now)).toBe(false)
  })

  it('canViewProofImages only admin01, case-insensitive email', () => {
    expect(canViewProofImages(actor('admin01'))).toBe(true)
    expect(canViewProofImages(actor('admin'))).toBe(false)
    expect(canViewProofImages({ role: 'teacher', email: 'admin01@seatsure.test' })).toBe(false)
  })
})

describe('bookSeat', () => {
  it('books as the actor (their token) and returns the stored booking', async () => {
    const { repo, bookings } = setup([])
    const booking = await bookings.bookSeat(actor('parent'), { courseId: COURSE_T1, studentName: '  Mali  ' })
    expect(repo.calls.bookSeat).toEqual([{ token: 'token-u-parent', courseId: COURSE_T1, studentName: 'Mali' }])
    expect(booking).toMatchObject({ course_id: COURSE_T1, user_id: 'u-parent', student_name: 'Mali', courses: { title: 'Piano' } })
  })

  it.each(['', '   '])('empty student name %j -> student_name_required, nothing booked', async (studentName) => {
    const { repo, bookings } = setup([])
    await expect(bookings.bookSeat(actor('parent'), { courseId: COURSE_T1, studentName })).rejects.toMatchObject({ code: 'student_name_required' })
    expect(repo.calls.bookSeat).toEqual([])
  })

  it('a refusal from the database keeps its code', async () => {
    const { bookings } = setup([])
    await expect(bookings.bookSeat(actor('parent'), { courseId: COURSE_FULL, studentName: 'Mali' })).rejects.toMatchObject({ code: 'course_full' })
  })
})

describe('myBookings', () => {
  it('returns only the actor’s own bookings', async () => {
    const { bookings } = setup([bookingRow({ id: 'mine' }), bookingRow({ id: 'theirs', user_id: 'u-parent2' })])
    const mine = await bookings.myBookings(actor('parent'))
    expect(mine.map((b) => b.id)).toEqual(['mine'])
  })
})

describe('getBooking', () => {
  it('owner gets the booking with course, payments and proofs', async () => {
    const { bookings } = setup([bookingRow({ id: 'b1' })])
    const booking = await bookings.getBooking(actor('parent'), 'b1')
    expect(booking).toMatchObject({ id: 'b1', courses: { title: 'Piano', price: 1500 }, payments: [] })
    expect(booking.payment_proofs).toHaveLength(1)
  })

  it.each(['parent2', 'teacher', 'admin'] as const)('%s (not the owner) -> booking_not_found', async (name) => {
    const { bookings } = setup([bookingRow({ id: 'b1' })])
    await expect(bookings.getBooking(actor(name), 'b1')).rejects.toMatchObject({ code: 'booking_not_found' })
  })

  it('unknown id -> booking_not_found', async () => {
    const { bookings } = setup([])
    await expect(bookings.getBooking(actor('parent'), 'nope')).rejects.toMatchObject({ code: 'booking_not_found' })
  })
})

describe('activeBookings', () => {
  const rows = [
    bookingRow({ id: 'p1-held', user_id: 'u-parent' }),
    bookingRow({ id: 'p1-paid', user_id: 'u-parent', status: 'paid', course_id: COURSE_T2 }),
    bookingRow({ id: 'p1-expired', user_id: 'u-parent', status: 'expired' }),
    bookingRow({ id: 'p1-cancelled', user_id: 'u-parent', status: 'cancelled' }),
    bookingRow({ id: 'p2-t2', user_id: 'u-parent2', course_id: COURSE_T2 }),
  ]

  it('parent: own held and paid bookings only', async () => {
    const { bookings } = setup(rows.slice())
    expect((await bookings.activeBookings(actor('parent'))).map((b) => b.id)).toEqual(['p1-held', 'p1-paid'])
  })

  it('teacher: held and paid bookings of the courses they teach', async () => {
    const { bookings } = setup(rows.slice())
    expect((await bookings.activeBookings(actor('teacher2'))).map((b) => b.id)).toEqual(['p1-paid', 'p2-t2'])
  })

  it('admin: every held and paid booking', async () => {
    const { bookings } = setup(rows.slice())
    expect((await bookings.activeBookings(actor('admin'))).map((b) => b.id)).toEqual(['p1-held', 'p1-paid', 'p2-t2'])
  })
})

describe('courseRoster', () => {
  const rows = [bookingRow({ id: 'r1', course_id: COURSE_T1 }), bookingRow({ id: 'r2', course_id: COURSE_T2 })]

  it('course teacher gets the roster without proof image URLs', async () => {
    const { repo, bookings } = setup(rows.slice())
    const roster = await bookings.courseRoster(actor('teacher'), COURSE_T1)
    expect(roster.map((r) => r.id)).toEqual(['r1'])
    expect(roster[0]!.payment_proofs[0]!.signed_url).toBeNull()
    expect(repo.calls.roster).toEqual([{ courseId: COURSE_T1, signProofs: false }])
  })

  it('another teacher -> forbidden, roster never read', async () => {
    const { repo, bookings } = setup(rows.slice())
    await expect(bookings.courseRoster(actor('teacher2'), COURSE_T1)).rejects.toMatchObject({ code: 'forbidden' })
    expect(repo.calls.roster).toEqual([])
  })

  it('parent -> forbidden', async () => {
    const { bookings } = setup(rows.slice())
    await expect(bookings.courseRoster(actor('parent'), COURSE_T1)).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('admin other than admin01: roster, proof URLs null', async () => {
    const { repo, bookings } = setup(rows.slice())
    await bookings.courseRoster(actor('admin'), COURSE_T2)
    expect(repo.calls.roster).toEqual([{ courseId: COURSE_T2, signProofs: false }])
  })

  it('admin01: roster with signed proof URLs', async () => {
    const { bookings } = setup(rows.slice())
    const roster = await bookings.courseRoster(actor('admin01'), COURSE_T2)
    expect(roster[0]!.payment_proofs[0]!.signed_url).toBe('https://signed/r2')
  })

  it('unknown course -> course_not_found', async () => {
    const { bookings } = setup(rows.slice())
    await expect(bookings.courseRoster(actor('admin'), '99999999-9999-4999-8999-999999999999')).rejects.toMatchObject({ code: 'course_not_found' })
  })
})
