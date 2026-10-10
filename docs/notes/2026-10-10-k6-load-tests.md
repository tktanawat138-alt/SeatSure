# k6 load tests

Date: 2026-10-10. Tool: [Grafana k6](https://github.com/grafana/k6) (`brew install k6`, tested with v2.3.0).

## What exists

`tests/load/` holds the scripts; `task test:load` runs them against the local API (it needs `task up`).

| Script | Load | Thresholds |
|---|---|---|
| `smoke.js` | 1 user, 20 s: health, login, `/me`, `/me` without a token (401) | failures < 1 %, p95 < 500 ms |
| `auth.js` | ramp to 25 users: login, `/me`, refresh | login p95 < 800 ms, `/me` p95 < 400 ms, refresh p95 < 800 ms, failures < 1 % |
| `booking.js` | 10 parents book the only seat of a fresh capacity-1 course at once (one `POST /bookings` each) | exactly one 201, nine `400 course_full` in the failure envelope, no other status, `http_req_failed` 0 (201 and 400 are expected statuses), one held seat in the roster after the run, all checks pass |

`config.js` refuses any `BASE_URL` that is not localhost unless `ALLOW_REMOTE=1`: the scripts sign in as
seeded accounts and generate load, so never aim them at a deployment you do not own.

## Findings

- Run the API with `npm start` in `apps/backend` (no file watcher) for load runs. With `tsx watch`
  (`task backend:api:up`) any edit restarts the server in the middle of the run and shows up as
  connection errors.
- Local Supabase Auth answered HTTP 500 to sign-in at roughly 250 sign-ins per second (a tight retry loop of
  50 users, 84 % failures). Sign-in is password hashing, so it is CPU-bound. At 25 users with 1 s think
  time everything passes (login p95 about 385 ms). The scripts sleep after a failed login so a failing user
  does not hammer the server.

## Booking contention (`booking.js`)

- `setup()` signs in teacher1 and admin01, creates a course through the API (`POST /courses`, capacity 1,
  title `K6 <ISO time> last seat`), approves it (`POST /courses/:id/approval`, which opens registration) and
  signs in parent1..parent10. The VUs therefore send only the booking, all at the same moment
  (`per-vu-iterations`, 10 VUs, 1 iteration each).
- Each response is counted in a custom `Counter`: `booking_successes` (201), `booking_course_full`
  (400 with `{ success: false, message: "course_full" }`) or `booking_unexpected` (anything else). The
  thresholds `count==1`, `count==9` and `count==0` fail the run otherwise.
- `teardown()` signs in admin@ (role admin), reads `GET /courses/:id/roster` and counts held rows into
  `booking_seats_held_after_run` (threshold `count==1`): the database, not only the responses, must show one
  seat. Metrics added in `teardown()` do count towards thresholds (checked with a capacity-2 copy, which fails
  with exit code 99).
- Then it cancels the course (`POST /courses/:id/cancel`), so it leaves the parents' list. k6 has no service
  key, so the cancelled course and its one booking stay in the database. They all carry the title prefix
  `K6 `; `task backend:reset` removes them, or delete them with the service key (bookings first, then the
  course).
- Every run creates a new course, so runs can repeat back to back. Measured: about 70 ms per booking request
  under the contention, two consecutive runs passed.
