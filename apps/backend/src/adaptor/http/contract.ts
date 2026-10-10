// Single source of truth for request and response shapes. Shared with the frontend
// through the `@contract` alias, so it may import only `zod`.
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1)
const isoDateTime = z.iso.datetime({ offset: true })
const bookingStatus = z.enum(['held', 'paid', 'cancelled', 'expired'])
const paymentStatus = z.enum(['succeeded', 'refund_due'])

// Responses. Field names and nullability mirror apps/frontend/src/entities.
export const CourseDto = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  teacher_id: z.string().nullable(),
  teacher_name: z.string().nullable(),
  capacity: z.number(),
  price: z.number(),
  registration_open: z.boolean(),
  seats_taken: z.number(),
  cancelled_at: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  approval_status: z.enum(['pending', 'approved', 'rejected']),
  approval_note: z.string().nullable(),
})

export const BookingDto = z.object({
  id: z.string(),
  course_id: z.string(),
  created_at: z.string(),
  hold_expires_at: z.string(),
  paid_at: z.string().nullable(),
  status: bookingStatus,
  student_name: z.string(),
  user_id: z.string(),
  courses: z.object({ title: z.string(), price: z.number() }),
  payments: z.array(
    z.object({
      id: z.string(),
      booking_id: z.string(),
      amount: z.number(),
      status: paymentStatus,
      receipt_no: z.string(),
      created_at: z.string(),
      idempotency_key: z.string(),
    }),
  ),
  payment_proofs: z.array(
    z.object({ id: z.string(), booking_id: z.string(), proof_path: z.string(), submitted_at: z.string() }),
  ),
})

// A bookings row without joins (GET /bookings/active): course cards and the teacher's student lists.
export const ActiveBookingDto = BookingDto.omit({ courses: true, payments: true, payment_proofs: true })

export const RosterRowDto = z.object({
  id: z.string(),
  student_name: z.string(),
  status: bookingStatus,
  hold_expires_at: z.string(),
  created_at: z.string(),
  profiles: z.object({ full_name: z.string() }),
  payments: z.array(
    z.object({ id: z.string(), amount: z.number(), status: paymentStatus, receipt_no: z.string() }),
  ),
  payment_proofs: z.array(
    z.object({
      id: z.string(),
      booking_id: z.string(),
      proof_path: z.string(),
      submitted_at: z.string(),
      signed_url: z.string().nullable(),
    }),
  ),
})

export const RefundReportDto = z.object({
  id: z.string(),
  payment_id: z.string(),
  booking_id: z.string(),
  course_id: z.string(),
  course_title: z.string(),
  student_name: z.string(),
  account_name: z.string(),
  account_email: z.string(),
  amount: z.number(),
  receipt_no: z.string(),
  cancellation_reason: z.string(),
  created_at: z.string(),
})

export const PaymentSystemDto = z.object({
  courses: z.array(CourseDto),
  refunds: z.array(RefundReportDto),
})

export const Session = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(), // epoch seconds
})

export const Me = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: z.enum(['parent', 'teacher', 'admin']),
})

// Requests.
// Upper bounds keep oversized input a 400 instead of a database error (500) or a stored blob.
export const LoginBody = z.object({ email: nonEmpty.max(254), password: nonEmpty.max(200) })
export const RefreshBody = z.object({ refreshToken: nonEmpty })

const capacity = z.number().int().min(1).max(1000)
const endsAfterStarts = (v: { startsAt: string; endsAt: string }) => Date.parse(v.endsAt) > Date.parse(v.startsAt)
const endsAfterStartsIssue = { message: 'endsAt must be after startsAt', path: ['endsAt'] }

export const CreateCourseBody = z
  .object({
    title: nonEmpty.max(200),
    description: z.string().max(2000),
    capacity,
    // numeric(10,2) in the database: baht with at most 2 decimals.
    price: z.number().finite().min(0).max(1_000_000).multipleOf(0.01),
    startsAt: isoDateTime,
    endsAt: isoDateTime,
  })
  .refine(endsAfterStarts, endsAfterStartsIssue)

// Any of capacity, registrationOpen, or startsAt+endsAt together.
export const UpdateCourseBody = z
  .object({
    capacity: capacity.optional(),
    registrationOpen: z.boolean().optional(),
    startsAt: isoDateTime.optional(),
    endsAt: isoDateTime.optional(),
  })
  .refine((v) => (v.startsAt === undefined) === (v.endsAt === undefined), {
    message: 'startsAt and endsAt must be sent together',
    path: ['startsAt'],
  })
  .refine((v) => v.capacity !== undefined || v.registrationOpen !== undefined || v.startsAt !== undefined, {
    message: 'at least one change is required',
  })
  .refine((v) => v.startsAt === undefined || v.endsAt === undefined || endsAfterStarts({ startsAt: v.startsAt, endsAt: v.endsAt }), endsAfterStartsIssue)

export const ApprovalBody = z.object({ approved: z.boolean() })
export const CancelCourseBody = z.object({ reason: nonEmpty.max(1000) })
export const BookSeatBody = z.object({ courseId: z.uuid(), studentName: nonEmpty.max(200) })

export const Envelope = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion('success', [
    z.object({ success: z.literal(true), data }),
    z.object({
      success: z.literal(false),
      message: z.string(),
      errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
    }),
  ])
export type Envelope<T> =
  | { success: true; data: T }
  | { success: false; message: string; errors?: { field: string; message: string }[] }

export type CourseDto = z.infer<typeof CourseDto>
export type BookingDto = z.infer<typeof BookingDto>
export type ActiveBookingDto = z.infer<typeof ActiveBookingDto>
export type RosterRowDto = z.infer<typeof RosterRowDto>
export type RefundReportDto = z.infer<typeof RefundReportDto>
export type PaymentSystemDto = z.infer<typeof PaymentSystemDto>
export type Session = z.infer<typeof Session>
export type Me = z.infer<typeof Me>
export type LoginBody = z.infer<typeof LoginBody>
export type RefreshBody = z.infer<typeof RefreshBody>
export type CreateCourseBody = z.infer<typeof CreateCourseBody>
export type UpdateCourseBody = z.infer<typeof UpdateCourseBody>
export type ApprovalBody = z.infer<typeof ApprovalBody>
export type CancelCourseBody = z.infer<typeof CancelCourseBody>
export type BookSeatBody = z.infer<typeof BookSeatBody>
