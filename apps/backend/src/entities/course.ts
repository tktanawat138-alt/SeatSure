import type { Actor } from './actor'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

/** A course as the API shows it. Same fields as the frontend entity and `CourseDto`. */
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
  approval_status: ApprovalStatus
  approval_note: string | null
}

/** What a teacher submits. Dates are ISO strings. */
export interface NewCourse {
  title: string
  description: string
  capacity: number
  price: number
  startsAt: string
  endsAt: string
}

const SCHOOL_ADMIN_EMAIL = 'admin01@seatsure.test'

/** Only this account approves courses (mirrors the `is_school_admin` SQL function). */
export const isSchoolAdmin = (actor: Pick<Actor, 'role' | 'email'>) =>
  actor.role === 'admin' && actor.email.toLowerCase() === SCHOOL_ADMIN_EMAIL

export const endsAfterStarts = (startsAt: string, endsAt: string) => Date.parse(endsAt) > Date.parse(startsAt)
