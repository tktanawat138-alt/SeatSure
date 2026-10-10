import { ActiveBookingDto, BookingDto, BookSeatBody, RosterRowDto } from '../contract'
import type { Endpoint } from './types'

const notAuthenticated = { status: 401, code: 'not_authenticated', description: 'Missing, invalid or expired bearer token.' }

export const bookingsEndpoints: Endpoint[] = [
  {
    method: 'post',
    path: '/bookings',
    operationId: 'bookSeat',
    summary: 'Book a seat in a course',
    description:
      'Holds one seat for the named student, as the signed-in user, and answers `201` with the new booking (status `held`). ' +
      'The seat count is checked under a row lock, so concurrent requests for the last seat give exactly one booking and `course_full` to the rest. ' +
      'An account can have one held or paid booking per course: a second request (for example a double-click) answers `already_booked`. ' +
      'Holds that ran out are released first. A transfer booking stays held for 7 days until payment is confirmed. ' +
      'The student name is trimmed; an empty or blank `studentName` answers `student_name_required` (the server checks it before the schema\'s non-empty rule, so it is never a `Validation failed`).',
    tag: 'Bookings',
    auth: 'any',
    request: { body: BookSeatBody },
    response: BookingDto,
    errors: [
      { status: 400, code: 'student_name_required', description: 'The student name is empty or blank.' },
      { status: 400, code: 'Validation failed', description: '`courseId` is missing or not a uuid; see `errors`.' },
      { status: 400, code: 'course_full', description: 'Every seat is paid or held.' },
      { status: 400, code: 'registration_closed', description: 'The course does not accept bookings now.' },
      { status: 400, code: 'already_booked', description: 'This account already holds or paid a seat in the course.' },
      { status: 400, code: 'course_not_approved', description: 'The course is pending, rejected or cancelled.' },
      { status: 404, code: 'course_not_found' },
      notAuthenticated,
    ],
  },
  {
    method: 'get',
    path: '/bookings/mine',
    operationId: 'listMyBookings',
    summary: 'List my bookings',
    description:
      "The signed-in user's own bookings, newest first, each with the course title and price, its payments (receipts and `refund_due` entries) and its transfer proof. Every role sees only its own bookings here.",
    tag: 'Bookings',
    auth: 'any',
    response: BookingDto.array(),
    errors: [notAuthenticated],
  },
  {
    method: 'get',
    path: '/bookings/active',
    operationId: 'listActiveBookings',
    summary: 'List held and paid bookings I can see',
    description:
      'Bookings with status `held` or `paid`, oldest first, without joins. A parent gets their own; a teacher gets their own plus the bookings of the courses they teach; an admin gets all. ' +
      'A `held` row whose `hold_expires_at` has passed no longer holds a seat: the client compares it with the current time (paid, or held and not yet expired, holds a seat). ' +
      'Used by the course cards ("already booked") and the teacher\'s student lists.',
    tag: 'Bookings',
    auth: 'any',
    response: ActiveBookingDto.array(),
    errors: [notAuthenticated],
  },
  {
    method: 'get',
    path: '/bookings/:id',
    operationId: 'getBooking',
    summary: 'Get one of my bookings',
    description:
      'One booking of the signed-in user with course, payments and transfer proof (the receipt page). Bookings of other accounts, unknown ids and malformed ids all answer `booking_not_found`, so the API does not reveal whether a booking exists.',
    tag: 'Bookings',
    auth: 'any',
    response: BookingDto,
    errors: [{ status: 404, code: 'booking_not_found', description: 'No booking with this id belongs to you.' }, notAuthenticated],
  },
  {
    method: 'get',
    path: '/courses/:id/roster',
    operationId: 'getCourseRoster',
    summary: 'List the students of a course',
    description:
      'Every booking of the course (any status), oldest first. Allowed for the course\'s teacher and for admins; another teacher gets `403 forbidden` and no data. ' +
      'Each viewer sees what the database policies allow them: the teacher gets the booking rows and student names only (`profiles.full_name` is `""`, `payments` and `payment_proofs` are empty); ' +
      'an admin also gets the parent\'s name and the payments; only the school admin (`admin01@seatsure.test`) also gets the transfer proofs, each with a `signed_url` to the private image valid for 600 seconds. ' +
      'For any other admin `payment_proofs` is empty.',
    tag: 'Bookings',
    auth: ['teacher', 'admin'],
    response: RosterRowDto.array(),
    errors: [
      { status: 403, code: 'forbidden', description: 'Not an admin, and not the teacher of this course.' },
      { status: 404, code: 'course_not_found' },
      notAuthenticated,
    ],
  },
]
