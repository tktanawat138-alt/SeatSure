import type { Course } from '@/entities/course'
import type { RefundReport } from '@/entities/payment-system'

/** Bank-transfer payments through the backend API. Failures reject with DomainError(code). */
export interface PaymentsGateway {
  /** Uploads the proof image for the caller's own held booking, replacing an earlier one. */
  submitProof(bookingId: string, file: Blob): Promise<void>
  /** Marks the booking paid once a proof is stored. Succeeds again when already paid. */
  confirm(bookingId: string): Promise<void>
  /** Admin only: every course with its seat count, and the refund reports newest first. */
  overview(): Promise<{ courses: Course[]; refunds: RefundReport[] }>
}
