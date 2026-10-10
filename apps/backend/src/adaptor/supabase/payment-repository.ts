import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Actor } from '../../entities/actor'
import { DomainError } from '../../entities/domain-error'
import type { BookingStatus, CourseSeats, RefundReport } from '../../entities/payment'
import type { PaymentRepository } from '../../interfaces/payment-repository'

/** `raise exception '<code>'` in an RPC arrives as P0001 with the code as message. */
function failure(step: string, error: PostgrestError): Error {
  if (error.code === 'P0001') return new DomainError(error.message)
  return new Error(`${step} failed: ${error.code ?? 'unknown'}`)
}

/** Payments data read and written as the actor, so row level security applies as it did in the browser. */
export function createSupabasePaymentRepository(clientFor: (actor: Actor) => SupabaseClient): PaymentRepository {
  return {
    async ownBooking(actor, bookingId) {
      const { data, error } = await clientFor(actor)
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .eq('user_id', actor.id)
        .maybeSingle()
      if (error) throw failure('booking lookup', error)
      return data ? { status: data.status as BookingStatus } : null
    },

    async proofOf(actor, bookingId) {
      const { data, error } = await clientFor(actor)
        .from('payment_proofs')
        .select('id, proof_path')
        .eq('booking_id', bookingId)
        .maybeSingle()
      if (error) throw failure('proof lookup', error)
      return data ? { id: data.id as string, path: data.proof_path as string } : null
    },

    async insertProof(actor, bookingId, path) {
      const { error } = await clientFor(actor).from('payment_proofs').insert({ booking_id: bookingId, proof_path: path })
      if (error) throw failure('proof insert', error)
    },

    async replaceProof(actor, proofId, path) {
      const { data, error } = await clientFor(actor)
        .from('payment_proofs')
        .update({ proof_path: path, submitted_at: new Date().toISOString() })
        .eq('id', proofId)
        .select('id')
      if (error) throw failure('proof update', error)
      // RLS matches only proofs of bookings that are still held: no row means the booking was
      // confirmed, cancelled or expired after the ownership check.
      if (!data || data.length === 0) throw new DomainError('booking_not_payable')
    },

    async confirmTransfer(actor, bookingId) {
      const { error } = await clientFor(actor).rpc('confirm_transfer_payment', { p_booking_id: bookingId })
      if (error) throw failure('confirm_transfer_payment', error)
    },

    async courses(actor) {
      const { data, error } = await clientFor(actor).from('course_seats').select().order('created_at')
      if (error) throw failure('course_seats', error)
      return (data ?? []) as CourseSeats[]
    },

    async refunds(actor) {
      const { data, error } = await clientFor(actor).from('refund_reports').select().order('created_at', { ascending: false })
      if (error) throw failure('refund_reports', error)
      return (data ?? []) as RefundReport[]
    },
  }
}
