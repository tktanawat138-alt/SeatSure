# supabase-js removed from the frontend (Task 8), 2026-10-10

## What

`@supabase/supabase-js` is no longer a dependency of `apps/frontend`. Every page reads and writes through use cases and the HTTP gateways (`src/adaptor/http/`); the browser only talks to the Express API.

- Deleted: `src/lib/supabase.ts` (the client, `fetchCourses`), `src/adaptor/supabase/*` (course-roster, my-bookings, payment-proof, payment-system gateways), their four ports in `src/interfaces/`, `tests/integration/adaptors.test.ts`, `tests/integration/legacy-session.test.ts` and the `table()` / `rpc()` helpers of `tests/integration/stub-network.ts`.
- Types that lived in `lib/supabase.ts` moved to `src/entities/`: `Course` (already there), `Booking` (`entities/booking.ts`, re-exports `ActiveBookingDto` from `@contract`) and `Profile` (`entities/profile.ts`, `id` and `full_name`). `Payment`, `PaymentProof` and `RefundReport` had no importer left or already live in `entities/`.
- `src/app/deps.ts`: `signIn = createSignIn(authGateway)`, `signOut = createSignOut(authGateway)`. The temporary `forgetLegacySession()` is gone.
- `useAutoRefresh(refresh)` lost its `..._legacyTables` rest parameter (see `2026-10-10-auto-refresh.md`).
- `tests/unit/layering.test.ts` now fails on any `@supabase` import or `@/lib/supabase` import anywhere under `src/`.
- `src/lib/format.ts` `errorText` gained Thai texts for `forbidden`, `invalid_course_schedule`, `course_not_found`, `proof_type_invalid` and `proof_size_exceeded`; `tests/unit/format.test.ts` covers them and a few older codes.
- `vite.config.ts` test env keeps only `VITE_API_URL`.

## Behaviour changes

- An admin can no longer open another user's receipt (the API returns only the owner's booking).
- CoursesPage fails as a whole if the active bookings call fails.
- Realtime updates are now polling (15 s + on tab focus).

## Decisions

- `database.types.ts` (generated typing for the old client) moved from `apps/frontend/src/lib/` to `apps/backend/src/adaptor/supabase/database.types.ts`: the backend integration test helper `apps/backend/tests/integration/helpers.ts` imports it. `task backend:types` writes to the new path. The frontend does not use it.
- `VITE_API_URL` is the only variable the browser bundle reads. `npm run build` output contains no `SERVICE_ROLE` string.

## Caveats

- `apps/frontend/.env.local` (written by `apps/backend/scripts/write-env.mjs`) still holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`: `apps/backend/vitest.config.ts` and `tests/vitest.config.ts` read them from that file, and the seed script uses them. Nothing in `apps/frontend/src` reads them; move them to the backend env file in a later task. `.env.example` marks them as non-bundled.
- `tests/integration/frontend-backend-contract.test.ts` (cross-app) still imports the deleted Supabase gateways and fails to load. Task 9 rewrites it.
