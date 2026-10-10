import type { Actor } from './actor'

export type BookingStatus = 'held' | 'paid' | 'cancelled' | 'expired'
export type PaymentStatus = 'succeeded' | 'refund_due'

/** A bookings row as stored. */
export interface BookingRow {
  id: string
  course_id: string
  user_id: string
  student_name: string
  status: BookingStatus
  hold_expires_at: string
  created_at: string
  paid_at: string | null
}

/** A booking as its owner sees it: with the course, payments and transfer proofs. */
export interface Booking extends BookingRow {
  courses: { title: string; price: number }
  payments: {
    id: string
    booking_id: string
    amount: number
    status: PaymentStatus
    receipt_no: string
    created_at: string
    idempotency_key: string
  }[]
  payment_proofs: { id: string; booking_id: string; proof_path: string; submitted_at: string }[]
}

/** One student on a course roster. `signed_url` is set only for viewers allowed to see proof images. */
export interface RosterRow {
  id: string
  student_name: string
  status: BookingStatus
  hold_expires_at: string
  created_at: string
  profiles: { full_name: string }
  payments: { id: string; amount: number; status: PaymentStatus; receipt_no: string }[]
  payment_proofs: { id: string; booking_id: string; proof_path: string; submitted_at: string; signed_url: string | null }[]
}

/** A hold only counts while its time has not run out. */
export const holdIsLive = (booking: Pick<BookingRow, 'status' | 'hold_expires_at'>, now: number) =>
  booking.status === 'held' && new Date(booking.hold_expires_at).getTime() > now

/** A seat is in use by a paid booking or a live hold. */
export const holdsSeat = (booking: Pick<BookingRow, 'status' | 'hold_expires_at'>, now: number) =>
  booking.status === 'paid' || holdIsLive(booking, now)

/**
 * Only the school admin (admin01) may open transfer proof images, as the Storage policy
 * "admin01 reads transfer proof images" (`is_school_admin()`) says.
 */
export const canViewProofImages = (actor: Pick<Actor, 'role' | 'email'>) =>
  actor.role === 'admin' && actor.email.toLowerCase() === 'admin01@seatsure.test'

/**
 * How much of a roster a viewer sees, matching the old RLS: a teacher sees booking rows only
 * (profiles, payments and payment_proofs were "own or admin"), an admin also sees parent names and
 * payments, and only the school admin (admin01) sees transfer proofs.
 */
export type RosterAccess = 'teacher' | 'admin' | 'school_admin'

export const rosterAccess = (actor: Pick<Actor, 'role' | 'email'>): RosterAccess =>
  canViewProofImages(actor) ? 'school_admin' : actor.role === 'admin' ? 'admin' : 'teacher'
