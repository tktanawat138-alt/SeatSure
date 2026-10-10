import type { Booking, BookingRow, RosterRow } from '../entities/booking'

/** Whose held/paid bookings to list: everyone's, or a user's own plus those of the courses they teach. */
export type ActiveScope = { all: true } | { userId: string; teacherId?: string }

/**
 * Bookings storage. Implementations throw DomainError with the database code when `bookSeat` is
 * refused (`course_full`, `registration_closed`, `already_booked`, `student_name_required`, ...).
 */
export interface BookingRepository {
  /** Books a seat as the user the token belongs to (the RPC reads `auth.uid()`); returns the new booking id. */
  bookSeat(token: string, courseId: string, studentName: string): Promise<string>
  /** The booking with course, payments and proofs, or null (also for an id that is not a uuid). */
  findBooking(id: string): Promise<Booking | null>
  /** A user's own bookings with course, payments and proofs, newest first. */
  listOwnBookings(userId: string): Promise<Booking[]>
  /** Held or paid bookings in the scope, oldest first. */
  listActive(scope: ActiveScope): Promise<BookingRow[]>
  /** The course's teacher id, or undefined when the course does not exist. */
  courseTeacher(courseId: string): Promise<{ teacherId: string | null } | undefined>
  /** Every booking of the course, oldest first; proof URLs are signed (600 s) only when `signProofs`. */
  roster(courseId: string, options: { signProofs: boolean }): Promise<RosterRow[]>
}
