# 2026-10-11 Backend test catalog

New guide page `docs/fern/pages/test-catalog-backend.mdx`: every backend test in `apps/backend/tests/**` with its input, what it validates
and the layer, a validation matrix per route, an auth matrix (route by role), the fixtures and error codes, the concurrency tests and the gaps.

## What was measured

| Run | Result |
|---|---|
| `vitest run --project unit` | 344 tests in 17 files, all pass |
| `vitest run --project integration` | 72 tests in 7 files, all pass |
| `npm run test:unsafe` | 69 pass, 3 fail on purpose: `r1-overbooking` (20 at once: 10 seats taken; 25 for 5: 14 seats) and `bookings-api` (20 at once: 10 succeeded) |

After the unsafe run `app_settings` was back to `safe` / `0` (global setup teardown) and no test course was left behind.

## Findings

- Unsafe mode now demonstrates R1 only. `book_seat` is the only function that reads `booking_mode`; `pay_booking` is retired, and
  `confirm_transfer_payment` always locks. The 5 parallel confirms and the cancel-confirm race pass in unsafe mode.
  `docs/fern/pages/testing.mdx` still says unsafe swaps the payment functions and that the repository `README.md` has a table of failures; the README has only the command.
- Untested: proof magic bytes (L3), rate limiting (M6, only the Supabase 429 mapping), M1/M2/M3 behaviour, expired holds being confirmable (L5),
  staff booking (L7), `course_not_approved` over HTTP, `payment_proof_file_missing`, the `courses_valid_schedule` mapping.
- `integration/helpers.ts` says a hold lasts 10 minutes; the `bookings_extend_transfer_window` trigger sets 7 days.
- Running the unsafe mode flips one shared `app_settings` row, so it also affects the API on :3001 and e2e while it runs.

## Caveats

- Counts are from one run on 2026-10-11; regenerate with `vitest run --project <name> --reporter=json` after adding tests.
- The page is not yet in `docs/fern/docs.yml` navigation or in `notes-index.mdx` (owned by other changes).
