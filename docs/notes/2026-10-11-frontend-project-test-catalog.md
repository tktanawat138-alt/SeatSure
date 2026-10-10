# Frontend and project test catalog pages, 2026-10-11

## What

Two docs pages list every test by file: `docs/fern/pages/test-catalog-frontend.mdx` (all of `apps/frontend/tests/`) and
`docs/fern/pages/test-catalog-project.mdx` (cross-app integration, Playwright e2e, k6, the test pyramid with CI job per
level, a "which test do I write" table and a test data and cleanup table).

## Why

`testing.mdx` says how to run tests but not what each one proves. The catalogs make it possible to see what is covered, and
what is not, without opening every file.

## Counts at the time of writing

Frontend 186 (unit 120 in 12 files, integration 66 in 4 files), backend unit 344, cross-app 12, e2e 24, k6 3 scripts.
Frontend and backend unit counts come from `vitest run`; e2e from `npx playwright test --list`. The pages do not auto-update:
rerun those commands after adding tests and fix the tables.

## Gaps recorded in the pages

- No React component or hook tests (Vitest runs in `node`); pages are covered only by Playwright, and some flows by nothing
  (`PaymentsPage`, rejecting a course, the roster dialog, teacher schedule edit, capacity and registration edits).
- 14 of the 23 `errorText` Thai messages have no unit test; `format.ts` helpers other than `errorText` are untested.
- k6 `booking.js` leaves one cancelled `K6 ...` course with a held booking per run; nothing deletes them.
- Load tests are not in CI.

## Caveats

- The pages link to `/test-catalog-backend` (written in parallel). The links only resolve once `docs.yml` lists all of the new
  pages, so `fern check` may report broken links until then.
- E2E, cross-app and k6 runtimes were not measured (they change shared data); only the frontend and backend unit runs were timed.
