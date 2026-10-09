export interface CourseRosterRow {
  id: string
  student_name: string
  status: 'held' | 'paid' | 'cancelled' | 'expired'
  hold_expires_at: string
  created_at: string
  profiles: { full_name: string }
  payments: { id: string; amount: number; status: 'succeeded' | 'refund_due'; receipt_no: string }[]
  payment_proofs: { id: string; booking_id: string; proof_path: string; submitted_at: string; signed_url: string | null }[]
}
