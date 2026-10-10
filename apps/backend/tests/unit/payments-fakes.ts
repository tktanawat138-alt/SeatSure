import type { Actor } from '../../src/entities/actor'
import { DomainError } from '../../src/entities/domain-error'
import type { BookingStatus, CourseSeats, RefundReport } from '../../src/entities/payment'
import type { PaymentRepository } from '../../src/interfaces/payment-repository'
import type { ProofStorage } from '../../src/interfaces/proof-storage'

export const actor = (id: string, role: Actor['role'] = 'parent'): Actor => ({ id, role, email: `${id}@test`, token: `token-${id}` })

export const course: CourseSeats = {
  id: 'c1',
  title: 'Math',
  description: '',
  teacher_id: null,
  teacher_name: null,
  capacity: 10,
  price: 1500,
  registration_open: true,
  seats_taken: 1,
  cancelled_at: null,
  cancellation_reason: null,
  starts_at: null,
  ends_at: null,
  approval_status: 'approved',
  approval_note: null,
}

export const refund: RefundReport = {
  id: 'r1',
  payment_id: 'p1',
  booking_id: 'b1',
  course_id: 'c1',
  course_title: 'Math',
  student_name: 'Student',
  account_name: 'Parent',
  account_email: 'parent@test',
  amount: 1500,
  receipt_no: 'RC-20261010-000001',
  cancellation_reason: 'closed',
  created_at: '2026-10-10T00:00:00.000Z',
}

/**
 * In-memory payments backend: bookings owned by users, one proof row per booking, stored objects,
 * and payments. `failNextSave` makes the next proof write throw, as a DB failure would.
 */
export function fakePayments() {
  const bookings = new Map<string, { userId: string; status: BookingStatus }>()
  const proofs = new Map<string, { id: string; path: string }>()
  const objects = new Set<string>()
  const payments: { bookingId: string }[] = []
  const state = { failNextSave: false, proofSeq: 0 }

  const own = (a: Actor, bookingId: string) => {
    const booking = bookings.get(bookingId)
    return booking && booking.userId === a.id ? booking : null
  }
  const save = () => {
    if (state.failNextSave) {
      state.failNextSave = false
      throw new Error('db down')
    }
  }

  const paymentRepository: PaymentRepository = {
    async ownBooking(a, bookingId) {
      const booking = own(a, bookingId)
      return booking ? { status: booking.status } : null
    },
    async proofOf(_a, bookingId) {
      return proofs.get(bookingId) ?? null
    },
    async insertProof(_a, bookingId, path) {
      save()
      proofs.set(bookingId, { id: `proof-${++state.proofSeq}`, path })
    },
    async replaceProof(_a, proofId, path) {
      save()
      for (const [bookingId, proof] of proofs) if (proof.id === proofId) proofs.set(bookingId, { id: proofId, path })
    },
    async confirmTransfer(a, bookingId) {
      const booking = own(a, bookingId)
      if (!booking) throw new DomainError('booking_not_found')
      if (booking.status === 'paid') return
      if (booking.status !== 'held') throw new DomainError('booking_not_payable')
      const proof = proofs.get(bookingId)
      if (!proof || !objects.has(proof.path)) throw new DomainError('payment_proof_required')
      booking.status = 'paid'
      payments.push({ bookingId })
    },
    async courses() {
      return [course]
    },
    async refunds() {
      return [refund]
    },
  }

  const proofStorage: ProofStorage & { uploads: { path: string; contentType: string; size: number }[] } = {
    uploads: [],
    async upload(_a, path, file) {
      proofStorage.uploads.push({ path, contentType: file.contentType, size: file.bytes.byteLength })
      objects.add(path)
    },
    async remove(_a, paths) {
      for (const path of paths) objects.delete(path)
    },
  }

  return { paymentRepository, proofStorage, bookings, proofs, objects, payments, state }
}
