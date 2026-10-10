import http from 'k6/http'
import { check, fail } from 'k6'
import exec from 'k6/execution'
import { Counter } from 'k6/metrics'
import { BASE_URL, bearer, isEnvelope, login, parentEmail } from './config.js'

// Ten parents book the only seat of a fresh capacity-1 course at the same moment. The row lock in
// book_seat must let exactly one through; everyone else gets 400 course_full in the failure
// envelope, and nothing answers 5xx. Each run creates its own course (title prefix "K6 ").
const PARENTS = 10

const successes = new Counter('booking_successes')
const courseFull = new Counter('booking_course_full')
const unexpected = new Counter('booking_unexpected')
const seatsHeld = new Counter('booking_seats_held_after_run')

export const options = {
  scenarios: {
    last_seat: { executor: 'per-vu-iterations', vus: PARENTS, iterations: 1, maxDuration: '30s' },
  },
  thresholds: {
    booking_successes: ['count==1'],
    booking_course_full: [`count==${PARENTS - 1}`],
    booking_unexpected: ['count==0'],
    booking_seats_held_after_run: ['count==1'],
    http_req_failed: ['rate==0'],
    checks: ['rate==1'],
  },
}

const json = (body) => JSON.stringify(body)

/** POSTs as `token` and returns `data`, or aborts the run: setup and teardown must not half-work. */
function must(path, token, body, what) {
  const res = http.post(`${BASE_URL}${path}`, json(body), { ...bearer(token), tags: { name: `setup ${what}` } })
  if (res.status !== 200 && res.status !== 201) fail(`${what}: ${res.status} ${res.body}`)
  return res.json('data')
}

export function setup() {
  const teacher = login('teacher1@seatsure.test')
  const admin01 = login('admin01@seatsure.test')
  if (!teacher || !admin01) fail('could not sign in teacher1 or admin01: run task up (seed)')

  const startsAt = new Date(Date.now() + 7 * 86_400_000)
  const endsAt = new Date(startsAt.getTime() + 3_600_000)
  const course = must('/courses', teacher.accessToken, {
    title: `K6 ${new Date().toISOString()} last seat`,
    description: 'k6 booking contention run',
    capacity: 1,
    price: 100,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  }, 'create course')
  must(`/courses/${course.id}/approval`, admin01.accessToken, { approved: true }, 'approve course')

  // Sign everyone in up front, so the VUs only send the booking and hit the seat together.
  const tokens = []
  for (let n = 1; n <= PARENTS; n++) {
    const session = login(parentEmail(n))
    if (!session) fail(`could not sign in ${parentEmail(n)}`)
    tokens.push(session.accessToken)
  }
  return { courseId: course.id, tokens }
}

export default function (data) {
  const token = data.tokens[exec.vu.idInTest - 1]
  const res = http.post(`${BASE_URL}/bookings`, json({ courseId: data.courseId, studentName: `k6 VU ${exec.vu.idInTest}` }), {
    ...bearer(token),
    tags: { name: 'POST /bookings' },
    responseCallback: http.expectedStatuses(201, 400),
  })

  const full = res.status === 400 && isEnvelope(res) && res.json('success') === false && res.json('message') === 'course_full'
  if (res.status === 201) successes.add(1)
  else if (full) courseFull.add(1)
  else unexpected.add(1)

  check(res, {
    'booking uses the envelope': isEnvelope,
    'booking is 201 or 400 course_full': (r) => r.status === 201 || full,
    'no 5xx': (r) => r.status < 500,
  })
}

export function teardown(data) {
  const admin = login('admin@seatsure.test')
  if (!admin) fail('could not sign in admin@seatsure.test for teardown')

  // What the database kept, independent of what the VUs saw.
  const roster = http.get(`${BASE_URL}/courses/${data.courseId}/roster`, { ...bearer(admin.accessToken), tags: { name: 'teardown roster' } })
  const held = roster.status === 200 ? roster.json('data').filter((row) => row.status === 'held').length : -1
  seatsHeld.add(held)
  check(roster, { 'exactly one seat is held after the run': () => held === 1 })

  // Close the course so it leaves the parents' list. The cancelled course and its booking stay in
  // the database (no service key in k6); they all carry the title prefix "K6 ".
  const cancel = http.post(`${BASE_URL}/courses/${data.courseId}/cancel`, json({ reason: 'k6 contention run' }), {
    ...bearer(admin.accessToken),
    tags: { name: 'teardown cancel' },
  })
  check(cancel, { 'teardown cancels the course': (r) => r.status === 200 })
}
