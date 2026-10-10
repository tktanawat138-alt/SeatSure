import { z } from 'zod'
import { ApprovalBody, CancelCourseBody, CourseDto, CreateCourseBody, UpdateCourseBody } from '../contract'
import type { Endpoint } from './types'

const unauthenticated = { status: 401, code: 'not_authenticated', description: 'Missing, invalid or expired access token.' }
const forbidden = { status: 403, code: 'forbidden', description: 'The role may not do this.' }
const invalid = { status: 400, code: 'Validation failed', description: 'The body or query does not match the schema; `errors` lists the fields.' }
const notFound = { status: 404, code: 'course_not_found', description: 'No course has this id (a malformed id counts as unknown).' }

export const coursesEndpoints: Endpoint[] = [
  {
    method: 'get',
    path: '/courses',
    operationId: 'listCourses',
    summary: 'List courses',
    description: [
      'What comes back depends on the caller. Query flags: `pending=true` (admin only) returns the approval queue, oldest first; `mine=true` limits the list to the caller\'s own courses.',
      '',
      '- Parent: approved courses that are not cancelled (closed registration still shows, with `registration_open=false`). Pending, rejected and cancelled courses never appear.',
      '- Teacher: their own courses whatever the approval status (pending, approved, rejected, cancelled). Asking for the pending queue is `forbidden`.',
      '- Admin: every approved course, cancelled ones included. With `pending=true`, the courses waiting for review.',
      '',
      '`seats_taken` counts paid bookings plus holds that have not run out; it is 0 for courses that are not approved. Oldest course first.',
    ].join('\n'),
    tag: 'Courses',
    auth: 'any',
    response: z.array(CourseDto),
    errors: [unauthenticated, forbidden, invalid],
  },
  {
    method: 'post',
    path: '/courses',
    operationId: 'createCourse',
    summary: 'Submit a course for approval',
    description: [
      'Teachers only. The course is created for the caller with `approval_status=pending` and `registration_open=false`; it stays hidden from parents until admin01 approves it.',
      '',
      'Title is trimmed, must not be empty and has at most 200 characters; `description` at most 2000. `capacity` is a whole number from 1 to 1000, `price` is 0 to 1,000,000 with at most 2 decimals, and `endsAt` must be after `startsAt` (ISO 8601 date-times).',
    ].join('\n'),
    tag: 'Courses',
    auth: ['teacher'],
    request: { body: CreateCourseBody },
    response: CourseDto,
    errors: [unauthenticated, forbidden, invalid, { status: 400, code: 'invalid_course_schedule', description: 'The schedule ends before it starts.' }],
  },
  {
    method: 'patch',
    path: '/courses/:id',
    operationId: 'updateCourse',
    summary: 'Change capacity, registration or schedule',
    description: [
      'Send any of `capacity`, `registrationOpen`, or `startsAt` together with `endsAt`.',
      '',
      '- Admin: `capacity` and `registrationOpen`. Changing the schedule is `forbidden`.',
      '- Teacher: the schedule of their own course only. Another teacher\'s course, or any other field, is `forbidden`.',
      '- Parent: `forbidden`.',
      '',
      'Capacity cannot drop below the seats already taken (`capacity_below_booked`). A cancelled course cannot reopen registration (`course_cancelled`); closing it is allowed. Returns the updated course.',
    ].join('\n'),
    tag: 'Courses',
    auth: ['teacher', 'admin'],
    request: { body: UpdateCourseBody },
    response: CourseDto,
    errors: [
      unauthenticated,
      forbidden,
      invalid,
      notFound,
      { status: 400, code: 'capacity_below_booked', description: 'The new capacity is lower than the seats already taken.' },
      { status: 400, code: 'course_cancelled', description: 'Registration cannot be reopened on a cancelled course.' },
      { status: 400, code: 'invalid_course_schedule', description: 'The schedule ends before it starts.' },
    ],
  },
  {
    method: 'post',
    path: '/courses/:id/approval',
    operationId: 'reviewCourse',
    summary: 'Approve or reject a submitted course',
    description: [
      'Only the school admin account (`admin01@seatsure.test`) may review; other admins get `admin01_required`, other roles `forbidden`.',
      '',
      '`approved=true` sets `approval_status=approved` and opens registration; `approved=false` sets `rejected` and keeps registration closed. Returns the updated course.',
      '',
      'Only a `pending` course can be reviewed. Reviewing an approved or rejected course again is `course_not_pending` (HTTP 409); to withdraw an approved course, cancel it so its bookings are refunded.',
    ].join('\n'),
    tag: 'Courses',
    auth: ['admin'],
    request: { body: ApprovalBody },
    response: CourseDto,
    errors: [
      unauthenticated,
      forbidden,
      { status: 403, code: 'admin01_required', description: 'The caller is an admin but not the school admin account.' },
      invalid,
      notFound,
      { status: 409, code: 'course_not_pending', description: 'The course was already approved or rejected.' },
    ],
  },
  {
    method: 'post',
    path: '/courses/:id/cancel',
    operationId: 'cancelCourse',
    summary: 'Cancel a course and report its refunds',
    description: [
      'Admin role only. Closes registration, records the reason, cancels every held or paid booking, marks succeeded payments `refund_due` and writes one `refund_reports` row per paid booking.',
      '',
      '`data` is the number of refunds reported. The reason is trimmed and required. A course can be cancelled once.',
    ].join('\n'),
    tag: 'Courses',
    auth: ['admin'],
    request: { body: CancelCourseBody },
    response: z.number().int(),
    errors: [
      unauthenticated,
      forbidden,
      invalid,
      notFound,
      { status: 400, code: 'cancellation_reason_required', description: 'The reason is blank.' },
      { status: 400, code: 'course_already_cancelled', description: 'The course was cancelled before.' },
    ],
  },
]
