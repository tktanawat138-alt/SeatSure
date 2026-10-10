# Backend API split: design

Date: 2026-10-10. Status: draft for review.

## Goal

Move all business logic out of the browser and the database into a real backend API service
(`apps/backend`), built with Clean Architecture so every layer is testable on its own. The
frontend stops calling Supabase directly and talks only to that API through an HTTP middleware
layer that owns authentication.

## Decisions (agreed with the human partner)

- Backend: Node + Express + TypeScript (GS Battery SOP web-dev track).
- Data and auth: keep Supabase as Postgres, Auth and Storage. The backend verifies Supabase
  JWTs and talks to the database with the service key. SQL functions that must be atomic
  (`book_seat`, `confirm_transfer_payment`, `cancel_course`) stay in migrations; RLS stays as a
  second line of defence.
- Scope: the whole system in one pass (every Supabase call the frontend makes today), split into
  four parallel work groups.
- Method: TDD. QA writes failing tests first; developers make them pass. Agent team, with an
  architect, QA, backend dev, frontend dev and a security reviewer.
- Realtime: replace Supabase Realtime in the browser with short polling through the API.
- Session storage: access and refresh tokens in `localStorage`, same exposure as supabase-js has
  today. httpOnly cookies are out of scope.

## Architecture

```
Browser -> Frontend (React) -> HTTP middleware -> Backend (Express) -> Supabase
```

### Backend (`apps/backend`)

```
src/
  entities/      Course, Booking, Payment, Proof, Role, DomainError   (no imports)
  interfaces/    ports: CourseRepository, BookingRepository, ProofStorage, AuthProvider
  use-cases/     bookSeat, confirmPayment, submitProof, createCourse, approveCourse,
                 updateCourse, cancelCourse, listCourses, myBookings, courseRoster,
                 paymentOverview, ...                                   (all business rules)
  adaptor/
    http/        Express routers, auth guard (JWT + role), zod validation, error envelope
    supabase/    implements the ports with supabase-js (service key) and RPC calls
  app.ts         createApp(deps): composition root, the only place that wires adaptors
  main.ts        process entry
supabase/        migrations, config (already here)
scripts/         env and seed
tests/unit, tests/integration
```

Dependencies point inwards. `entities`, `interfaces` and `use-cases` import neither `express` nor
`@supabase/*`. A layering test enforces it (same idea as the frontend one). Use cases throw
`DomainError(code)`; the HTTP adaptor maps codes to status codes. Every response uses the SOP
envelope: `{ success: true, data }` or `{ success: false, message, errors? }`.

Business rules that move into use cases (examples): a teacher's new course is created as
`pending`; only the admin approves or rejects; a proof needs a valid image type and size
(<= 5 MB: jpeg, png, webp); confirming payment needs a stored proof; a teacher sees the roster
of their own courses only; a booking can be confirmed only by its owner.

### API

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me` |
| Courses | `GET /courses` (approved), `POST /courses` (teacher), `PATCH /courses/:id`, `POST /courses/:id/approval` (admin), `POST /courses/:id/cancel` |
| Bookings | `POST /bookings`, `GET /bookings/mine`, `GET /bookings/:id`, `GET /courses/:id/roster` |
| Payments | `PUT /bookings/:id/proof`, `POST /bookings/:id/confirm-payment`, `GET /admin/payments`, `GET /admin/refunds` |

The architect pins exact request and response shapes in `apps/backend/src/adaptor/http/contract.ts`
(zod schemas, types exported for the frontend gateways) before any work group starts.

### Frontend (`apps/frontend`)

The existing `entities`, `interfaces` and `use-cases` stay. The Supabase adaptors are replaced:

```
src/adaptor/http/
  client.ts           middleware: Bearer token, one refresh on 401 then retry, logout when
                      refresh fails, timeout, error envelope -> DomainError(code), never logs tokens
  session-store.ts    access and refresh token storage
  <area>-gateway.ts   implements the existing interfaces over the client
```

`lib/auth.tsx`, the login page and every page that calls Supabase directly move to use cases
and gateways. `supabase-js` is removed from the frontend dependencies.

## Tests

| Where | What |
|---|---|
| `apps/backend/tests/unit/` | use-case business rules with fake ports; guards (role, validation); layering |
| `apps/backend/tests/integration/` | API over HTTP (supertest) against real Supabase, plus the existing overbooking, proof and RLS tests |
| `apps/frontend/tests/unit/` | use cases, layering, styling rules |
| `apps/frontend/tests/integration/` | middleware (401 -> refresh -> retry, logout, error mapping) and gateways over a stubbed network |
| `tests/integration/` | frontend gateways against the running backend API |
| `tests/e2e/` | Playwright: login, book, attach proof, confirm, for parent, teacher and admin |

`task up` starts Supabase, the backend API and the frontend. `task test` runs every level.

## Work plan (agent team, TDD)

1. Architect: contract, ports, folder skeleton, Taskfile wiring.
2. QA: failing tests per work group (unit, integration, e2e).
3. In parallel, per group: backend dev and frontend dev make tests pass.
   Groups: Auth, Courses, Bookings, Payments.
4. Security review: JWT verification, role checks, upload validation, CORS, secret handling.
5. Lead integrates, runs `task test` to green.

## Out of scope

httpOnly cookie sessions, Supabase Realtime in the browser, deployment changes
(Cloudflare serves the static frontend today; where the Express API is hosted is a follow-up),
replacing Postgres or Supabase Auth.

## Cleanup

Delete the stray root `supabase/` folder (two CLI temp files, `.branches` and `.temp`) and add
it to `.gitignore`. The real project is `apps/backend/supabase/`.

## Risks

- One-pass migration touches about 8 pages and every gateway; review is large. Mitigated by the
  four groups and a fixed contract.
- Hosting for the API is undecided; local development is unaffected.
