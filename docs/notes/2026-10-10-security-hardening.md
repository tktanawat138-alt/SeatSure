# 2026-10-10 Security hardening (task 9 follow-up)

Fixes for part of the security review of the backend API split
(`.superpowers/sdd/2026-10-10-backend-api-split/task-9-security-report.md`, local only). The other findings need a business
or infrastructure decision and are listed below, untouched.

## What was fixed

| ID | Fix | Where |
|---|---|---|
| M4 | `confirm_transfer_payment` locks the course row, then the booking row (the order `cancel_course` uses) and refuses a cancelled course with `course_cancelled`. A confirm and a cancel at the same moment now serialize: either the payment exists before the cancel reports refunds (booking cancelled, payment `refund_due`, one refund report) or the confirm sees the cancelled booking and is refused with no payment. Before, the cancel could miss the new payment and leave a `succeeded` payment on a cancelled booking with no refund report. | `apps/backend/supabase/migrations/20261016000000_confirm_locks_course.sql` |
| M5 | `reviewCourse` accepts only a `pending` course. Approving or rejecting again is `course_not_pending` (HTTP 409, Thai text `คอร์สนี้ผ่านการพิจารณาแล้ว`). Withdrawing an approved course goes through cancel, which refunds. | `use-cases/courses.ts`, `error-handler.ts`, `apps/frontend/src/lib/format.ts` |
| M7 | Security event log: one JSON line on stdout per failed login (`email_hash`, `ip`), per 401/403 (route pattern, status, actor id) and per admin course action (review, update, cancel, with outcome). No tokens, passwords, bodies, Authorization header or emails in clear. | `adaptor/http/security-log.ts`, wired in `app.ts`, `courses.routes.ts`, `error-handler.ts`; see [Backend](../fern/pages/backend.mdx) |
| L1 | Upper bounds in the contract: `capacity` 1..1000, `price` 0..1,000,000 with 2 decimals, `title` 200, `description` 2000, `studentName` 200, `reason` 1000, `email` 254, `password` 200. Oversized input is a 400 instead of a Postgres 22003 turned into 500. | `adaptor/http/contract.ts` |
| L2 | `x-powered-by` disabled, `X-Content-Type-Options: nosniff` everywhere, `Cache-Control: no-store` on `/auth/*` and `/me`. | `app.ts` |
| L6 | `.gitignore` ignores `.env` and `.env.*` everywhere, keeps `.env.example`. The tracked env files did not change. | `.gitignore` |
| L8 | The seed prints the password only for the local database. | `apps/backend/scripts/seed.mjs` |
| L9 | `resolveApiBase(env)`: the `http://localhost:3001` fallback only in development; a production build without `VITE_API_URL` throws at startup. | `apps/frontend/src/adaptor/http/client.ts` |

## Decisions

- **`course_cancelled` stays HTTP 400.** It already existed (PATCH reopen of a cancelled course) and the frontend gateway test pins 400, so it was not moved to 409. Only the new `course_not_pending` is 409.
- **Order of checks in confirm.** After both locks: already `paid` returns (idempotent), not `held` is `booking_not_payable` (unchanged), then a cancelled course is `course_cancelled`. In the normal race the cancel has already cancelled the booking, so the parent sees `booking_not_payable`; `course_cancelled` covers a course marked cancelled without its bookings (for example by a direct database write, see M3).
- **Expired holds are unchanged.** The old `pay_booking` still confirmed an expired hold when a seat was free, and the current confirm never checked expiry, so the migration does not add an expiry check (that is L5, not fixed).
- **One line per event.** A refused admin action (for example `admin01_required`) is logged once, as `admin_action` with its 4xx status, not again as `forbidden`. The guard now sets `req.actor` before the role check so a 403 carries the actor id.
- **Log to stdout only.** No `audit_log` table: storing an audit trail in the database is part of M7's longer fix and needs a retention decision.

## Not fixed (needs a decision), untouched

| ID | Why it is left |
|---|---|
| M1 | Open sign-up and 7-day holds: disabling sign-up, captcha or hold limits is a product decision and a cloud Auth setting. |
| M2 | Parents mark their own transfer as paid: an admin review state changes the payment flow and the receipts. |
| M3 | Direct PostgREST/Storage access with the user JWT: column grants, `app_settings` revoke and a shorter JWT expiry change the database contract and the cloud config. |
| M6 | Rate limiting: needs a limiter dependency, a proxy/`trust proxy` decision and Auth limit settings. |
| L3 | Proof magic-byte check: kept for the payments owner, tied to M2. |
| L4 | Default privileges migration: changes grants for every future object; needs a review of all migrations. |
| L5 | Expired holds can still be confirmed: business rule (see Decisions). |
| L7 | Staff can book: product decision on who may book. |
| I1-I6 | Informational: admin01 by email, teacher sees parents' ids, P0001 allow-list, `shadcn` in dependencies, preflight envelope, proof cleanup. |

## How to verify

```bash
cd apps/backend
supabase migration up                    # applies 20261016000000 locally
npx vitest run --project unit tests/unit/use-cases/courses.test.ts tests/unit/api/security-log.test.ts \
  tests/unit/api/headers.test.ts tests/unit/contract.test.ts tests/unit/api/error-handler.test.ts
npx vitest run --project integration tests/integration/cancel-confirm-race.test.ts tests/integration/courses-api.test.ts
cd ../frontend && npx vitest run tests/unit/format.test.ts tests/unit/api-base.test.ts
```

`cancel-confirm-race.test.ts` fires the admin cancel and the parent confirm with `Promise.all` for 10 rounds. Against the
old function it failed in 2 of 3 runs (a `succeeded` payment with no refund report); with the migration both outcomes
occur (about half each) and the end state is always consistent.

## Caveats

- The race test is probabilistic: it shows the bug often but not on every run against the old function.
- The API process must be restarted to pick up the HTTP changes (headers, log, bounds, review rule); the database change applies at once.
- The security log goes to stdout only; shipping and retention are up to the deployment.
