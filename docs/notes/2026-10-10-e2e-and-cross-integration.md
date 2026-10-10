# Cross-app integration and e2e specs (Task 9), 2026-10-10

## What exists

Cross-app integration (`tests/integration/`, `cd tests && npx vitest run` or `task test:integration:cross`)
- `frontend-backend-contract.test.ts`, 12 tests. It imports the frontend's real use cases from `@/app/deps`, so the real HTTP gateways, client middleware (`adaptor/http/client.ts`) and session store run against the API on `http://localhost:3001`.
- `tests/vitest.config.ts` sets `VITE_API_URL` (override with `API_URL`), aliases `@` and `@contract` like `apps/frontend/vite.config.ts`, and loads `integration/local-storage.ts`, an in-memory `localStorage` (Node 26 exposes `localStorage` as `undefined` without `--localstorage-file`).
- It no longer reads `apps/frontend/.env.local`. The service key for cleanup comes from `apps/backend/.env.local` through `tests/e2e/support/env.ts` (the caveat about this in `2026-10-10-supabase-js-removed.md` is out of date for `/tests`).
- Responses are parsed with the zod schemas from `contract.ts` (`Me`, `CourseDto`, `BookingDto`), so a renamed or retyped field fails here.

E2E (`tests/e2e/`, `cd tests && npx playwright test` or `task test:e2e`), 24 tests
- `auth.spec.ts` (6), `booking-payment.spec.ts` (2), `course-lifecycle.spec.ts` (6), plus the older `login.spec.ts` (1) and `theme.spec.ts` (9).
- `playwright.config.ts` starts the API (`npm start --prefix ../apps/backend`, waits for `/health`) and the frontend, each with `reuseExistingServer: !process.env.CI`. `workers: 1`, `fullyParallel: false`, `trace: 'on-first-retry'`, a global setup for stale data.
- Helpers in `tests/e2e/support/`: `env.ts` (backend env file, `runId`, 1x1 PNG), `api.ts` (API sign-in, `createApprovedCourse` as teacher1 + admin01, `book`, `bookAndPay`), `service.ts` (service-role cleanup over PostgREST and Storage with plain `fetch`, no supabase-js in `/tests`), `ui.ts` (sign in by form or demo button, `datetime-local` value).

## How data is arranged and cleaned

- Preconditions go through the API as the real users: teacher1 creates a course, admin01 approves it (which opens registration), parents book, upload the proof (`PUT /bookings/:id/proof`, raw `image/png`) and confirm. Only cleanup uses the service key.
- Courses created by e2e are titled `E2E <runId> ...`. Each spec's `afterAll` calls `cleanupByTitlePrefix('E2E <runId>')`, which deletes in FK order: refund reports, payment proof rows (and their Storage objects, by the stored `proof_path`), payments, bookings, refund reports by course, courses. The global setup runs the same cleanup for every `E2E ` title, to remove what an interrupted run left.
- The cross-app test books the seeded course `คณิตศาสตร์เสริม ม.1` (capacity 20) with the first of parent3..parent10 who holds no seat in it, and deletes that booking (with proof image and payment) in `afterAll`.
- The full-course case is made deterministic: parent3 opens the booking dialog while one seat is left, parent4 takes it through the API, then parent3 confirms and gets `course_full` (`คอร์สนี้เต็มแล้ว`).
- The cancel case pays a booking through the API with parent5's token, then admin@ cancels through the UI.
- Verified: three consecutive full Playwright runs passed, and no `E2E` course, booking or proof object remained afterwards.

## Product changes

- `apps/frontend/src/components/admin/course-approval-queue.tsx`: the approve and reject buttons got `aria-label="อนุมัติ <title>"` / `"ปฏิเสธ <title>"`. Before, every row had identical "อนุมัติ" buttons, which a screen reader (and a role locator) could not tell apart. The visible text is unchanged and starts the accessible name.

## Bugs found

- No product bug: every documented behaviour checked here (Thai error texts, refresh on a garbled access token, sign-out on a garbled refresh token, admin01-only approval queue, refund count toast, receipt number) works as described.
- Test infrastructure, backend: `apps/backend/tests/integration/helpers.ts:137` `cleanup()` does not delete `refund_reports` and ignores the errors of its deletes. `courses-api.test.ts:170` cancels a paid course made by the `createCourse` helper (title `Test course <runId>-NN`), but that file's `afterAll` (line 21) deletes refund reports only for `API test %` titles. The refund report then blocks the delete of the booking (FK `on delete restrict`), the batched booking delete fails as a whole, and with it the courses and the test users. Every backend integration run leaves `Test course ...` rows, held bookings and `Test parent NN` profiles in the local database. Fix there: delete `refund_reports` by course in `cleanup()` before the bookings, and throw on delete errors.

## Flaky-risk caveats

- The specs share the seeded accounts. A person clicking around in the app during a run does not break them (each spec books only its own fresh courses), but `task backend:reset` mid-run does.
- `auth.spec.ts` and the cross-app test expect the seeded course `คณิตศาสตร์เสริม ม.1` to exist (and, for the cross test, to have a free seat and a parent among parent3..10 without a seat in it).
- Toasts (sonner) vanish after a few seconds; each toast assertion runs right after the action, well inside that window.
- Pages poll every 15 s. A refresh during a test re-renders lists but keeps the open dialog (its state lives in the page), so the locators do not go stale.
- Logout ends only the current session on the server (`scope: local`), so a logout in one test does not sign out sessions other tests or helpers hold.
- `course-lifecycle.spec.ts` fills `datetime-local` inputs in the browser's local time zone, 14 days ahead, so the date is never in the past.
- The admin course table and the approval queue grow with leftovers of other suites (see the helpers bug above). Locators filter rows by the unique `E2E <runId>` title, so the size does not matter, only speed.
