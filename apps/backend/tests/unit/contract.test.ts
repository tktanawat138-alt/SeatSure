import { describe, expect, it } from 'vitest'
import {
  ApprovalBody,
  BookSeatBody,
  BookingDto,
  CancelCourseBody,
  CourseDto,
  CreateCourseBody,
  Envelope,
  LoginBody,
  Me,
  PaymentSystemDto,
  RosterRowDto,
  Session,
  UpdateCourseBody,
} from '../../src/adaptor/http/contract'
import { z } from 'zod'

const UUID = '3f2b8a52-6f0e-4c53-9d6e-0a1b2c3d4e5f'

const course = {
  id: UUID,
  title: 'Piano',
  description: 'Beginner piano',
  teacher_id: UUID,
  teacher_name: 'Khun Somchai',
  capacity: 10,
  price: 1500,
  registration_open: true,
  seats_taken: 3,
  cancelled_at: null,
  cancellation_reason: null,
  starts_at: '2026-11-01T09:00:00+00:00',
  ends_at: '2026-11-01T11:00:00+00:00',
  approval_status: 'approved',
  approval_note: null,
}

const booking = {
  id: UUID,
  course_id: UUID,
  created_at: '2026-10-10T10:00:00+00:00',
  hold_expires_at: '2026-10-10T10:15:00+00:00',
  paid_at: null,
  status: 'held',
  student_name: 'Mali',
  user_id: UUID,
  courses: { title: 'Piano', price: 1500 },
  payments: [
    { id: UUID, booking_id: UUID, amount: 1500, status: 'succeeded', receipt_no: 'R-1', created_at: '2026-10-10T10:01:00+00:00', idempotency_key: 'k1' },
  ],
  payment_proofs: [{ id: UUID, booking_id: UUID, proof_path: 'a/b.png', submitted_at: '2026-10-10T10:02:00+00:00' }],
}

const rosterRow = {
  id: UUID,
  student_name: 'Mali',
  status: 'paid',
  hold_expires_at: '2026-10-10T10:15:00+00:00',
  created_at: '2026-10-10T10:00:00+00:00',
  profiles: { full_name: 'Parent One' },
  payments: [{ id: UUID, amount: 1500, status: 'refund_due', receipt_no: 'R-1' }],
  payment_proofs: [{ id: UUID, booking_id: UUID, proof_path: 'a/b.png', submitted_at: '2026-10-10T10:02:00+00:00', signed_url: null }],
}

const refund = {
  id: UUID,
  payment_id: UUID,
  booking_id: UUID,
  course_id: UUID,
  course_title: 'Piano',
  student_name: 'Mali',
  account_name: 'Parent One',
  account_email: 'p@example.com',
  amount: 1500,
  receipt_no: 'R-1',
  cancellation_reason: 'Teacher ill',
  created_at: '2026-10-10T10:03:00+00:00',
}

const create = {
  title: 'Piano',
  description: 'Beginner piano',
  capacity: 10,
  price: 1500,
  startsAt: '2026-11-01T09:00:00Z',
  endsAt: '2026-11-01T11:00:00Z',
}

describe('contract DTOs accept the frontend entity shapes', () => {
  it('CourseDto accepts a course', () => {
    expect(CourseDto.safeParse(course).success).toBe(true)
    const typed: CourseDto = CourseDto.parse(course)
    expect(typed.approval_status).toBe('approved')
  })
  it('CourseDto accepts a cancelled, pending course with null dates', () => {
    const c = { ...course, cancelled_at: '2026-10-11T00:00:00Z', cancellation_reason: 'x', starts_at: null, ends_at: null, approval_status: 'pending', teacher_id: null, teacher_name: null }
    expect(CourseDto.safeParse(c).success).toBe(true)
  })
  it('BookingDto accepts a booking', () => expect(BookingDto.safeParse(booking).success).toBe(true))
  it('RosterRowDto accepts a roster row', () => expect(RosterRowDto.safeParse(rosterRow).success).toBe(true))
  it('PaymentSystemDto accepts courses and refunds', () =>
    expect(PaymentSystemDto.safeParse({ courses: [course], refunds: [refund] }).success).toBe(true))
  it('Session accepts tokens and epoch-seconds expiry', () =>
    expect(Session.safeParse({ accessToken: 'a', refreshToken: 'r', expiresAt: 1790000000 }).success).toBe(true))
  it.each(['parent', 'teacher', 'admin'])('Me accepts role %s', (role) =>
    expect(Me.safeParse({ id: UUID, email: 'a@b.co', fullName: 'A', role }).success).toBe(true))
})

describe('contract DTOs reject bad shapes', () => {
  it.each([
    ['unknown approval_status', { ...course, approval_status: 'maybe' }],
    ['missing title', { ...course, title: undefined }],
    ['NaN price', { ...course, price: Number.NaN }],
    ['seats_taken as string', { ...course, seats_taken: '3' }],
  ])('CourseDto rejects %s', (_n, bad) => expect(CourseDto.safeParse(bad).success).toBe(false))
  it('BookingDto rejects an unknown status', () => expect(BookingDto.safeParse({ ...booking, status: 'done' }).success).toBe(false))
  it('BookingDto rejects a payment with an unknown status', () =>
    expect(BookingDto.safeParse({ ...booking, payments: [{ ...booking.payments[0], status: 'failed' }] }).success).toBe(false))
  it('RosterRowDto rejects a missing profile', () => expect(RosterRowDto.safeParse({ ...rosterRow, profiles: undefined }).success).toBe(false))
  it('Me rejects an unknown role', () => expect(Me.safeParse({ id: UUID, email: 'a@b.co', fullName: 'A', role: 'root' }).success).toBe(false))
  it('Session rejects a missing refreshToken', () => expect(Session.safeParse({ accessToken: 'a', expiresAt: 1 }).success).toBe(false))
  it('Session rejects an empty refreshToken or accessToken', () => {
    expect(Session.safeParse({ accessToken: 'a', refreshToken: '', expiresAt: 1 }).success).toBe(false)
    expect(Session.safeParse({ accessToken: '', refreshToken: 'r', expiresAt: 1 }).success).toBe(false)
  })
})

describe('LoginBody', () => {
  it('accepts email and password', () => expect(LoginBody.safeParse({ email: 'a@b.co', password: 'pw' }).success).toBe(true))
  it.each([
    ['missing password', { email: 'a@b.co' }],
    ['empty email', { email: '  ', password: 'pw' }],
    ['empty password', { email: 'a@b.co', password: '' }],
  ])('rejects %s', (_n, bad) => expect(LoginBody.safeParse(bad).success).toBe(false))
})

describe('CreateCourseBody', () => {
  it('accepts a valid body', () => expect(CreateCourseBody.safeParse(create).success).toBe(true))
  it('accepts price 0', () => expect(CreateCourseBody.safeParse({ ...create, price: 0 }).success).toBe(true))
  it.each([
    ['capacity 0', { ...create, capacity: 0 }],
    ['fractional capacity', { ...create, capacity: 1.5 }],
    ['price -1', { ...create, price: -1 }],
    ['NaN price', { ...create, price: Number.NaN }],
    ['Infinity price', { ...create, price: Number.POSITIVE_INFINITY }],
    ['blank title', { ...create, title: '   ' }],
    ['missing description', { ...create, description: undefined }],
    ['endsAt equals startsAt', { ...create, endsAt: create.startsAt }],
    ['endsAt before startsAt', { ...create, endsAt: '2026-11-01T08:00:00Z' }],
    ['startsAt not ISO', { ...create, startsAt: 'tomorrow' }],
  ])('rejects %s', (_n, bad) => expect(CreateCourseBody.safeParse(bad).success).toBe(false))
})

describe('UpdateCourseBody', () => {
  it('accepts capacity alone', () => expect(UpdateCourseBody.safeParse({ capacity: 5 }).success).toBe(true))
  it('accepts registrationOpen alone', () => expect(UpdateCourseBody.safeParse({ registrationOpen: false }).success).toBe(true))
  it('accepts startsAt and endsAt together', () =>
    expect(UpdateCourseBody.safeParse({ startsAt: create.startsAt, endsAt: create.endsAt }).success).toBe(true))
  it.each([
    ['empty body', {}],
    ['capacity 0', { capacity: 0 }],
    ['startsAt without endsAt', { startsAt: create.startsAt }],
    ['endsAt without startsAt', { endsAt: create.endsAt }],
    ['endsAt equals startsAt', { startsAt: create.startsAt, endsAt: create.startsAt }],
    ['endsAt before startsAt', { startsAt: create.endsAt, endsAt: create.startsAt }],
    ['registrationOpen as string', { registrationOpen: 'yes' }],
  ])('rejects %s', (_n, bad) => expect(UpdateCourseBody.safeParse(bad).success).toBe(false))
})

describe('small request bodies', () => {
  it('ApprovalBody accepts a boolean', () => expect(ApprovalBody.safeParse({ approved: false }).success).toBe(true))
  it('ApprovalBody rejects a missing flag', () => expect(ApprovalBody.safeParse({}).success).toBe(false))
  it('CancelCourseBody accepts a reason', () => expect(CancelCourseBody.safeParse({ reason: 'Teacher ill' }).success).toBe(true))
  it('CancelCourseBody rejects a blank reason', () => expect(CancelCourseBody.safeParse({ reason: '  ' }).success).toBe(false))
  it('BookSeatBody accepts a uuid and a name', () =>
    expect(BookSeatBody.safeParse({ courseId: UUID, studentName: 'Mali' }).success).toBe(true))
  it.each([
    ['empty studentName', { courseId: UUID, studentName: '' }],
    ['blank studentName', { courseId: UUID, studentName: '   ' }],
    ['non-uuid courseId', { courseId: 'abc', studentName: 'Mali' }],
    ['missing courseId', { studentName: 'Mali' }],
  ])('BookSeatBody rejects %s', (_n, bad) => expect(BookSeatBody.safeParse(bad).success).toBe(false))
})

describe('request bounds (security review L1)', () => {
  const long = (n: number) => 'x'.repeat(n)
  it.each([
    ['capacity 1000', { ...create, capacity: 1000 }],
    ['price 1000000', { ...create, price: 1_000_000 }],
    ['price with 2 decimals', { ...create, price: 1234.56 }],
    ['title of 200 characters', { ...create, title: long(200) }],
    ['description of 2000 characters', { ...create, description: long(2000) }],
  ])('CreateCourseBody accepts %s', (_n, ok) => expect(CreateCourseBody.safeParse(ok).success).toBe(true))
  it.each([
    ['capacity 1001', { ...create, capacity: 1001 }],
    ['capacity 3000000000', { ...create, capacity: 3_000_000_000 }],
    ['price 1000000.01', { ...create, price: 1_000_000.01 }],
    ['price 1e9', { ...create, price: 1e9 }],
    ['price with 3 decimals', { ...create, price: 12.345 }],
    ['title of 201 characters', { ...create, title: long(201) }],
    ['description of 2001 characters', { ...create, description: long(2001) }],
  ])('CreateCourseBody rejects %s', (_n, bad) => expect(CreateCourseBody.safeParse(bad).success).toBe(false))
  it('UpdateCourseBody rejects capacity 1001 and accepts 1000', () => {
    expect(UpdateCourseBody.safeParse({ capacity: 1001 }).success).toBe(false)
    expect(UpdateCourseBody.safeParse({ capacity: 1000 }).success).toBe(true)
  })
  it('BookSeatBody bounds studentName at 200 characters', () => {
    expect(BookSeatBody.safeParse({ courseId: UUID, studentName: long(200) }).success).toBe(true)
    expect(BookSeatBody.safeParse({ courseId: UUID, studentName: long(201) }).success).toBe(false)
  })
  it('CancelCourseBody bounds reason at 1000 characters', () => {
    expect(CancelCourseBody.safeParse({ reason: long(1000) }).success).toBe(true)
    expect(CancelCourseBody.safeParse({ reason: long(1001) }).success).toBe(false)
  })
  it('LoginBody bounds email at 254 and password at 200 characters', () => {
    const email = `${long(246)}@test.co`
    expect(email).toHaveLength(254)
    expect(LoginBody.safeParse({ email, password: long(200) }).success).toBe(true)
    expect(LoginBody.safeParse({ email: `x${email}`, password: 'pw' }).success).toBe(false)
    expect(LoginBody.safeParse({ email: 'a@b.co', password: long(201) }).success).toBe(false)
  })
  it('bounds apply after trimming: a 200 character title with surrounding spaces is accepted', () =>
    expect(CreateCourseBody.safeParse({ ...create, title: `  ${long(200)}  ` }).success).toBe(true))
})

describe('Envelope', () => {
  const schema = Envelope(z.object({ n: z.number() }))
  it('accepts success with data', () => expect(schema.safeParse({ success: true, data: { n: 1 } }).success).toBe(true))
  it('accepts failure with message and field errors', () =>
    expect(schema.safeParse({ success: false, message: 'bad', errors: [{ field: 'capacity', message: 'min 1' }] }).success).toBe(true))
  it('accepts failure without errors', () => expect(schema.safeParse({ success: false, message: 'bad' }).success).toBe(true))
  it('rejects success with wrong data', () => expect(schema.safeParse({ success: true, data: { n: 'x' } }).success).toBe(false))
  it('rejects failure without a message', () => expect(schema.safeParse({ success: false }).success).toBe(false))
})
