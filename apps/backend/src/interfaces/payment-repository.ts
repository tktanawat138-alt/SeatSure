import type { Actor } from '../entities/actor'
import type { BookingStatus, CourseSeats, RefundReport, StoredProof } from '../entities/payment'

/**
 * Bookings, proofs and payments, read and written as the actor (row level security applies).
 * Rule failures reported by the database surface as DomainError(code).
 */
export interface PaymentRepository {
  /** The actor's own booking, or null when it does not exist or belongs to someone else. */
  ownBooking(actor: Actor, bookingId: string): Promise<{ status: BookingStatus } | null>
  proofOf(actor: Actor, bookingId: string): Promise<StoredProof | null>
  insertProof(actor: Actor, bookingId: string, path: string): Promise<void>
  /**
   * Points an existing proof row at a new object and resets its submission time. Throws
   * booking_not_payable when no row was updated because the booking is no longer held.
   */
  replaceProof(actor: Actor, proofId: string, path: string): Promise<void>
  /**
   * Marks the booking paid and writes one payment with a receipt number. Succeeds without a
   * second payment when already paid. Throws booking_not_found, booking_not_payable,
   * payment_proof_required.
   */
  confirmTransfer(actor: Actor, bookingId: string): Promise<void>
  courses(actor: Actor): Promise<CourseSeats[]>
  /** Newest first. */
  refunds(actor: Actor): Promise<RefundReport[]>
}
