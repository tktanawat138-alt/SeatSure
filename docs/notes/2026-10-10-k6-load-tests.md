# k6 load tests

Date: 2026-10-10. Tool: [Grafana k6](https://github.com/grafana/k6) (`brew install k6`, tested with v2.3.0).

## What exists

`tests/load/` holds the scripts; `task test:load` runs them against the local API (it needs `task up`).

| Script | Load | Thresholds |
|---|---|---|
| `smoke.js` | 1 user, 20 s: health, login, `/me`, `/me` without a token (401) | failures < 1 %, p95 < 500 ms |
| `auth.js` | ramp to 25 users: login, `/me`, refresh | login p95 < 800 ms, `/me` p95 < 400 ms, refresh p95 < 800 ms, failures < 1 % |

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

## Next

A booking contention scenario (many users booking the last seat, expect exactly one success) belongs here once
the bookings endpoints exist: `tests/load/booking.js`.
