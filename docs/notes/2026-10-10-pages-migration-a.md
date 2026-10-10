# Pages migration, part A (Task 8), 2026-10-10

CoursesPage, MyBookingsPage, ReceiptPage and PaymentsPage no longer import the supabase client; they use the use cases from `src/app/deps.ts`.

## What changed

- **CoursesPage**: `listCourses()` and `loadActiveBookings()` replace `fetchCourses` and the `bookings` query; `bookSeat({ courseId, studentName })` replaces the `book_seat` RPC. A failed booking still shows `errorText(error)` and reloads; success still goes to `/bookings`. The client-side `cancelled_at` / `approval_status` filter stays as a guard. A failed `loadActiveBookings` now fails the whole load (before, a failed bookings query was silently an empty list).
- **ReceiptPage**: `loadBooking(id)` replaces the `bookings` select with `courses(title)` and `payments(*)`. The API answers 404 `booking_not_found` (unknown id, someone else's booking, malformed id); the page maps it to the existing "not found" state, as `maybeSingle()` returning null did. Any other failure (network, 5xx) also shows "not found", as before (the old code ignored the query error). Admins can no longer open another user's receipt: the API only returns the owner's bookings (before, RLS let an admin read any).
- **MyBookingsPage**: it already used the use cases. Only the `useAutoRefresh` call lost its table arguments. Upload errors were checked: `proof_type_invalid` and `proof_size_exceeded` keep their own messages, every other `DomainError` goes through `errorText` (so `booking_not_found`, `booking_not_payable` and `payment_proof_required` show their Thai text, which fixes the caveat in the payments note).
- **PaymentsPage**: only `useAutoRefresh(load)` changed.
- `CourseCard` takes `mine: ActiveBooking` (from `interfaces/bookings-gateway`) and the booking components take `Course` from `entities/course`; no more `@/lib/supabase` imports in `components/booking`.

## Caveats

- Styling and Thai text are untouched; no `.styles.ts` changed.
- Pages are covered by e2e (Task 9); no new tests, there was no pure logic to extract.
