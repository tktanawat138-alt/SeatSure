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
