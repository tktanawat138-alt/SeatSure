import type { Actor } from '../entities/actor'
import { DomainError } from '../entities/domain-error'
import { isProofType, MAX_PROOF_BYTES, proofExtension, type PaymentOverview, type ProofFile } from '../entities/payment'
import type { PaymentRepository } from '../interfaces/payment-repository'
import type { ProofStorage } from '../interfaces/proof-storage'

const requireAdmin = (actor: Actor) => {
  if (actor.role !== 'admin') throw new DomainError('forbidden')
}

/** Best effort: a leftover object is harmless, the failure that caused the cleanup matters more. */
const quietly = (work: Promise<void>) => work.catch(() => undefined)

export function createPayments(
  { paymentRepository: repo, proofStorage: storage }: { paymentRepository: PaymentRepository; proofStorage: ProofStorage },
  newId: () => string = () => crypto.randomUUID(),
) {
  return {
    /**
     * Stores a bank-transfer proof for the actor's own held booking. A second proof replaces the
     * first (same row, old object removed). If recording fails, the new object is removed.
     */
    async submitProof(actor: Actor, bookingId: string, file: ProofFile): Promise<void> {
      if (!isProofType(file.contentType)) throw new DomainError('proof_type_invalid')
      if (file.bytes.byteLength === 0) throw new DomainError('payment_proof_required')
      if (file.bytes.byteLength > MAX_PROOF_BYTES) throw new DomainError('proof_size_exceeded')

      const booking = await repo.ownBooking(actor, bookingId)
      if (!booking) throw new DomainError('booking_not_found')
      if (booking.status !== 'held') throw new DomainError('booking_not_payable')

      const path = `${actor.id}/${bookingId}-${newId()}.${proofExtension(file.contentType)}`
      await storage.upload(actor, path, file)
      let previous: string | null = null
      try {
        const existing = await repo.proofOf(actor, bookingId)
        if (existing) {
          await repo.replaceProof(actor, existing.id, path)
          previous = existing.path
        } else {
          await repo.insertProof(actor, bookingId, path)
        }
      } catch (error) {
        await quietly(storage.remove(actor, [path]))
        throw error
      }
      if (previous) await quietly(storage.remove(actor, [previous]))
    },

    /** Confirms the transfer: paid with one receipt. Idempotent once paid. */
    confirmPayment: (actor: Actor, bookingId: string) => repo.confirmTransfer(actor, bookingId),

    async paymentOverview(actor: Actor): Promise<PaymentOverview> {
      requireAdmin(actor)
      const [courses, refunds] = await Promise.all([repo.courses(actor), repo.refunds(actor)])
      return { courses, refunds }
    },

    async refunds(actor: Actor) {
      requireAdmin(actor)
      return repo.refunds(actor)
    },
  }
}

export type Payments = ReturnType<typeof createPayments>
