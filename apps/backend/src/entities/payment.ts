/** Image types accepted as a bank-transfer proof. */
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type ProofContentType = (typeof PROOF_TYPES)[number]

/** Largest proof image, in bytes (5 MiB). The storage bucket enforces the same limit. */
export const MAX_PROOF_BYTES = 5 * 1024 * 1024

export const isProofType = (type: string): type is ProofContentType => (PROOF_TYPES as readonly string[]).includes(type)

/** File extension of a stored proof: png, webp, or jpg for jpeg. */
export const proofExtension = (type: ProofContentType) => (type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg')

/** An uploaded proof image as received. */
export interface ProofFile {
  contentType: string
  bytes: Uint8Array
}

/** A recorded proof: the `payment_proofs` row id and its storage object path. */
export interface StoredProof {
  id: string
  path: string
}

export type BookingStatus = 'held' | 'paid' | 'cancelled' | 'expired'

/** A `course_seats` row, as the admin payment overview lists it. */
export interface CourseSeats {
  id: string
  title: string
  description: string
  teacher_id: string | null
  teacher_name: string | null
  capacity: number
  price: number
  registration_open: boolean
  seats_taken: number
  cancelled_at: string | null
  cancellation_reason: string | null
  starts_at: string | null
  ends_at: string | null
  approval_status: 'pending' | 'approved' | 'rejected'
  approval_note: string | null
}

/** A refund owed after a course was cancelled with paid bookings. */
export interface RefundReport {
  id: string
  payment_id: string
  booking_id: string
  course_id: string
  course_title: string
  student_name: string
  account_name: string
  account_email: string
  amount: number
  receipt_no: string
  cancellation_reason: string
  created_at: string
}

export interface PaymentOverview {
  courses: CourseSeats[]
  refunds: RefundReport[]
}
