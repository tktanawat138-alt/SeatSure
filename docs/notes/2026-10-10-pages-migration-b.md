# AdminPage and TeacherPage onto the use cases (Task 8b), 2026-10-10

## What changed

`apps/frontend/src/pages/AdminPage.tsx` and `TeacherPage.tsx` no longer use supabase-js; they call the use cases from `app/deps.ts`. Only the types `Course` still come from `@/lib/supabase` (the controller moves them). Text, toasts, states and styling are unchanged.

AdminPage
- Table: `listCourses()`. Approval queue: `listCourses({ pending: true })`.
- Approve/reject: `reviewCourse(id, approved)`. Capacity and registration toggle: `updateCourse(id, { capacity })` / `{ registrationOpen }`. Cancel: `cancelCourse(id, reason)`, its result is the refund count in the toast.
- The local handlers are `handleReview` and `handleCancel` so they do not shadow the use cases.
- `run` wraps a use-case promise; a thrown error (a `DomainError`, whose message is the API error code) becomes the same toast as before through `errorText`.

TeacherPage
- Own courses: `listCourses({ mine: true })`, cancelled ones still filtered out client-side (the API includes them). `seats_taken` and `teacher_name` now come from the API.
- Students: `loadActiveBookings()` (teacher gets bookings of own courses), typed `ActiveBooking`.
- Create: `createCourse(draft)`, then a full refresh. Schedule: `updateCourseSchedule`.
- `useAutoRefresh(refresh)` without table names.

## Behaviour differences

- A forbidden schedule change shows `ทำรายการไม่สำเร็จ (forbidden)` instead of `... (course_schedule_update_denied)`. Neither code has a Thai entry in `lib/format.ts` (there was none before either); add `forbidden` there if a Thai text is wanted.
- An unparsable or inverted date on create now fails with `invalid_course_schedule` (no Thai entry, shows `ทำรายการไม่สำเร็จ (invalid_course_schedule)`) instead of an uncaught `RangeError`.
- After creating a course the page runs the normal refresh, so a cancelled course no longer reappears in the list (the old re-fetch skipped the cancelled filter).
- Refresh and mutations need the API running.
