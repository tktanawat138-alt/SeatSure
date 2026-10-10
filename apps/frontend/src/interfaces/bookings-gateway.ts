import type { CourseRosterRow } from '@/entities/course-roster'
import type { MyBooking } from '@/entities/my-booking'

/** A booking without joins: what the course cards and the teacher's student lists read. */
export interface ActiveBooking {
  id: string
  course_id: string
  user_id: string
  student_name: string
  status: 'held' | 'paid' | 'cancelled' | 'expired'
  hold_expires_at: string
  created_at: string
  paid_at: string | null
}

/** Rejects with DomainError(code); the code is the API's error message. */
export interface BookingsGateway {
  /** Holds a seat; rejects course_full, registration_closed, already_booked, student_name_required, ... */
  book(input: { courseId: string; studentName: string }): Promise<MyBooking>
  /** The signed-in user's bookings, newest first, with course, payments and proofs joined by the API. */
  mine(): Promise<MyBooking[]>
  /** Held and paid bookings the user may see: own, of the courses they teach, or all (admin). */
  active(): Promise<ActiveBooking[]>
  /** One of the user's own bookings (receipt); anyone else's rejects booking_not_found. */
  get(bookingId: string): Promise<MyBooking>
  /** Course teacher or admin; proof image URLs only for admin01. */
  roster(courseId: string): Promise<CourseRosterRow[]>
}
