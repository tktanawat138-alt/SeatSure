export interface MyBooking {
  id: string
  course_id: string
  created_at: string
  hold_expires_at: string
  paid_at: string | null
  status: 'held' | 'paid' | 'cancelled' | 'expired'
  student_name: string
  user_id: string
  courses: { title: string; price: number }
  payments: { id: string; booking_id: string; amount: number; status: 'succeeded' | 'refund_due'; receipt_no: string; created_at: string; idempotency_key: string }[]
  payment_proofs: { id: string; booking_id: string; proof_path: string; submitted_at: string }[]
}
