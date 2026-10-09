export interface Course {
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
