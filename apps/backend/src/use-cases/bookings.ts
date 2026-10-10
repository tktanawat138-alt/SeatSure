import type { Actor } from '../entities/actor'
import { rosterAccess, type Booking, type BookingRow, type RosterRow } from '../entities/booking'
import { DomainError } from '../entities/domain-error'
import type { ActiveScope, BookingRepository } from '../interfaces/booking-repository'

export function createBookings(repo: BookingRepository) {
  async function ownBooking(actor: Actor, id: string): Promise<Booking> {
    const booking = await repo.findBooking(id)
    if (!booking || booking.user_id !== actor.id) throw new DomainError('booking_not_found')
    return booking
  }

  return {
    /** Holds a seat for the actor's student. Seat and duplicate rules live in the `book_seat` RPC. */
    async bookSeat(actor: Actor, input: { courseId: string; studentName: string }): Promise<Booking> {
      const studentName = input.studentName.trim()
      if (!studentName) throw new DomainError('student_name_required')
      const id = await repo.bookSeat(actor.token, input.courseId, studentName)
      // If this read fails the booking still exists and the caller gets a 500; a retry answers already_booked.
      return ownBooking(actor, id)
    },

    myBookings: (actor: Actor): Promise<Booking[]> => repo.listOwnBookings(actor.id),

    /** Only the owner sees a booking; anyone else gets booking_not_found, as if it did not exist. */
    getBooking: ownBooking,

    /** Held or paid bookings the actor may see: own, of the courses they teach, or (admin) all. */
    activeBookings(actor: Actor): Promise<BookingRow[]> {
      const scope: ActiveScope =
        actor.role === 'admin' ? { all: true } : actor.role === 'teacher' ? { userId: actor.id, teacherId: actor.id } : { userId: actor.id }
      return repo.listActive(scope)
    },

    /** The course teacher or an admin; each sees what the old RLS showed them (see rosterAccess). */
    async courseRoster(actor: Actor, courseId: string): Promise<RosterRow[]> {
      if (actor.role !== 'admin' && actor.role !== 'teacher') throw new DomainError('forbidden')
      const course = await repo.courseTeacher(courseId)
      if (!course) throw new DomainError('course_not_found')
      if (actor.role === 'teacher' && course.teacherId !== actor.id) throw new DomainError('forbidden')
      return repo.roster(courseId, rosterAccess(actor))
    },
  }
}

export type Bookings = ReturnType<typeof createBookings>
