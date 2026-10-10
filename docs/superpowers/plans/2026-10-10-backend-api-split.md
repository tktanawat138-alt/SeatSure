# Backend API Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all business logic into an Express + TypeScript API (`apps/backend`) with Clean Architecture; the frontend talks only to that API through an auth middleware.

**Architecture:** Backend layers `entities -> interfaces -> use-cases -> adaptor/{http,supabase}`, wired in `app.ts`. Supabase stays as Postgres/Auth/Storage; atomic SQL functions stay. Frontend keeps its existing `entities/interfaces/use-cases`; only the gateways change from `adaptor/supabase` to `adaptor/http` over one `client.ts` middleware.

**Tech Stack:** Express 5, zod, `@supabase/supabase-js` (backend only), vitest, supertest, tsx; React + vitest + Playwright on the frontend side.

**Spec:** `docs/superpowers/specs/2026-10-10-backend-api-split-design.md`

## Global Constraints

- Existing behaviour is preserved exactly (human partner: "ทำเหมือนเดิมเลย"). Same rules, same error codes (`course_full`, `registration_closed`, `already_booked`, `booking_not_found`, `payment_proof_required`, `booking_not_payable`, `bank_transfer_only`, `course_cancelled`, `capacity_below_booked`, `not_authenticated`, ...), same Thai UI text, same 15 s refresh.
- Roles: `parent`, `teacher`, `admin`. Course approval and viewing proof images require `admin01@seatsure.test` (`is_school_admin`); cancelling a course and reading refund reports require role `admin` (`is_admin`). Seed gets `admin01@seatsure.test` (password `seatsure123`) in addition to `admin@seatsure.test`.
- Proof upload: `image/jpeg|png|webp`, max 5 MiB (`proof_type_invalid`, `proof_size_exceeded`). Signed proof URLs live 600 s.
- Booking hold: 7 days (set by DB trigger). Course price/capacity rules stay in SQL.
- Response envelope: `{ success: true, data }` / `{ success: false, message, errors? }`; validation failures are HTTP 400 (not 422).
- Ports: `entities`, `interfaces`, `use-cases` import neither `express` nor `@supabase/*` (layering test enforces). A use case receives `actor: { id, role, email, token }` and throws `DomainError(code)`.
- Frontend: no `supabase-js` after Task 8; styling stays in `.styles.ts` (CVA); only shadcn components.
- Ports/URLs: API `http://localhost:3001` (`API_PORT`), frontend `VITE_API_URL`, CORS allows only the frontend origin from `FRONTEND_ORIGIN`. Never log tokens or the service key.
- TDD: every task writes failing tests first, sees them fail, then implements. Commit per task.

## Review Focus

- Expired access token mid-request: middleware refreshes once and retries; a failed refresh logs out and does not loop.
- Teacher requests another teacher's roster or edits another teacher's course: 403, no data.
- Proof upload with wrong MIME, over 5 MiB, empty body, or for someone else's booking: rejected with the exact code, no storage object left behind.
- Two confirms of the same booking in parallel, and a double-click on "book": one payment / one booking.
- Backend unreachable or 5xx: UI shows its existing load-error text instead of a blank page.

---

## File Structure

```
apps/backend/src/
  entities/       course.ts booking.ts payment.ts actor.ts domain-error.ts
  interfaces/     auth-provider.ts course-repository.ts booking-repository.ts proof-storage.ts payment-repository.ts
  use-cases/      auth.ts courses.ts bookings.ts payments.ts
  adaptor/http/   app-routes.ts contract.ts guard.ts errors.ts auth.routes.ts courses.routes.ts bookings.routes.ts payments.routes.ts
  adaptor/supabase/ client.ts auth-provider.ts course-repository.ts booking-repository.ts proof-storage.ts payment-repository.ts
  app.ts  main.ts
apps/frontend/src/adaptor/http/ client.ts session-store.ts *-gateway.ts
```

### Task 1: Backend scaffold, cleanup, Taskfile

**Files:** Create `apps/backend/{tsconfig.json,src/app.ts,src/main.ts}`, `apps/backend/tests/unit/layering.test.ts`; Modify `apps/backend/package.json`, `Taskfile.yml`, `.gitignore`, `apps/backend/scripts/seed.mjs`; Delete root `supabase/`.
**Interfaces:** Produces `createApp(deps: AppDeps): express.Express`; `GET /health -> { success:true, data:{ ok:true } }`.

- [ ] Step 1: failing tests: `tests/unit/layering.test.ts` (same rule table as the frontend: entities/interfaces/use-cases may not import `express`, `@supabase`, `adaptor`), and `tests/integration/health.test.ts` using supertest: `GET /health` is 200 with the envelope.
- [ ] Step 2: run `npm test` in `apps/backend`; expect both FAIL (missing module).
- [ ] Step 3: add deps (express, zod, cors, @supabase/supabase-js; dev: typescript, tsx, supertest, @types/*), scripts `dev` (`tsx watch src/main.ts`), `start`, `typecheck`; implement `createApp` with json parser, CORS from `FRONTEND_ORIGIN`, `/health`, and the error-envelope handler placeholder; `main.ts` listens on `API_PORT` (3001).
- [ ] Step 4: `git rm -r supabase`; add `/supabase/` to `.gitignore`; add `admin01@seatsure.test` (role admin) to `seed.mjs`.
- [ ] Step 5: Taskfile: `backend:api:up` (background, port 3001, log `.backend.log`, stop by port like the frontend) wired into `up`/`down`; `write-env.mjs` also writes `apps/backend/.env.local` (URL, anon key, service key, `FRONTEND_ORIGIN`) and frontend `.env.local` gets `VITE_API_URL`.
- [ ] Step 6: tests pass; `task up` then `curl localhost:3001/health` is 200. Commit.

### Task 2: API contract (architect)

**Files:** Create `apps/backend/src/adaptor/http/contract.ts`; Test `apps/backend/tests/unit/contract.test.ts`.
**Interfaces:** Produces zod schemas and inferred types, exported for the frontend (`@seatsure/contract` path alias `@contract` in the frontend `tsconfig`/vite): `LoginBody{email,password}`, `Session{accessToken,refreshToken,expiresAt}`, `Me{id,email,fullName,role}`, `CourseDto` (same fields as the frontend `entities/course.ts`), `CreateCourseBody{title,description,capacity,price,startsAt,endsAt}`, `UpdateCourseBody` (any of `capacity`, `registrationOpen`, `startsAt`+`endsAt`), `ApprovalBody{approved}`, `CancelCourseBody{reason}`, `BookSeatBody{courseId,studentName}`, `BookingDto` (same as frontend `MyBooking`), `RosterRowDto` (same as `CourseRosterRow`), `PaymentSystemDto{courses,refunds}`, `Envelope<T>`.

- [ ] Step 1: failing tests: each schema accepts the sample from the frontend entity files and rejects missing/negative/NaN fields (`capacity: 0`, `price: -1`, `endsAt <= startsAt`, empty `studentName`).
- [ ] Step 2: run, expect FAIL.
- [ ] Step 3: implement schemas so DTO types equal the existing frontend entity types (frontend entities become re-exports of contract types in Task 8).
- [ ] Step 4: pass; commit.

### Task 3: Auth group (backend + frontend middleware)

**Files:** Backend: `entities/actor.ts`, `interfaces/auth-provider.ts`, `use-cases/auth.ts`, `adaptor/supabase/auth-provider.ts`, `adaptor/http/{guard.ts,auth.routes.ts}`. Frontend: `adaptor/http/{client.ts,session-store.ts,auth-gateway.ts}`, `interfaces/auth-gateway.ts`, `use-cases/{sign-in,sign-out,load-me}.ts`; Modify `lib/auth.tsx`, `pages/LoginPage.tsx`, `components/app-shell.tsx`.
**Interfaces:**
- Backend: `AuthProvider { signIn(email,password): Promise<Session>; refresh(refreshToken): Promise<Session>; signOut(accessToken): Promise<void>; verify(accessToken): Promise<{id,email}>; profile(id): Promise<{fullName,role}> }`; guard `requireAuth(roles?: Role[])` sets `req.actor`; `GET /me`.
- Frontend: `apiClient.request<T>(method, path, body?, opts?): Promise<T>` (adds `Authorization`, one refresh+retry on 401, then `sessionStore.clear()` and `DomainError('not_authenticated')`; envelope errors become `DomainError(message)`; 15 s timeout), `sessionStore { get(); set(Session); clear(); subscribe(fn) }`.

- [ ] Step 1: backend unit tests (fake `AuthProvider`): `signIn` wrong password -> `DomainError('Invalid login credentials')`; guard 401 `not_authenticated` without/with bad token; guard 403 `forbidden` when role not allowed; `/me` returns profile. Backend integration (real Supabase): login as `parent1@seatsure.test` returns a usable token, `/me` works, refresh issues a new token, logout invalidates.
- [ ] Step 2: frontend integration tests (stubbed fetch): 401 -> refresh -> original retried once; refresh fails -> store cleared and `not_authenticated`; envelope error mapped to `DomainError`; no `Authorization` header when signed out.
- [ ] Step 3: run all; expect FAIL.
- [ ] Step 4: implement backend (Supabase auth adaptor uses the anon client for `signInWithPassword`/`refreshSession`, service client for `getUser(token)`); implement `client.ts` + `session-store.ts` (localStorage, try/catch around every access).
- [ ] Step 5: switch `lib/auth.tsx` (session from store, profile from `/me`, `signOut` clears store), `LoginPage` (`signIn` use case, error via `errorText`), `app-shell` logout. Existing demo-account buttons keep working.
- [ ] Step 6: pass; commit.

### Task 4: Courses group

**Files:** Backend `entities/course.ts`, `interfaces/course-repository.ts`, `use-cases/courses.ts`, `adaptor/supabase/course-repository.ts`, `adaptor/http/courses.routes.ts`. Frontend `adaptor/http/courses-gateway.ts`, `interfaces/courses-gateway.ts`, `use-cases/{list-courses,create-course,update-course,review-course,cancel-course}.ts` (+ existing `update-course-schedule` re-pointed).
**Interfaces:** Backend use cases: `listCourses(actor, filter?: {teacherId?; pending?}): CourseDto[]` (parent/any: approved only; teacher: own incl. pending; admin: all, pending queue via filter), `createCourse(actor, body): CourseDto` (teacher only; `approval_status='pending'`, `registration_open=false`), `updateCourse(actor, id, body)` (admin: capacity/registrationOpen; teacher: own schedule; `capacity_below_booked`, `course_cancelled` from DB mapped), `reviewCourse(actor, id, approved)` (only `admin01`; sets `registration_open=approved`), `cancelCourse(actor, id, reason): number` (role admin; returns refund count via `cancel_course`).

- [ ] Step 1: unit tests with a fake `CourseRepository` for every rule above plus: teacher cannot edit another's course (`forbidden`), non-admin01 cannot review (`admin01_required`), invalid schedule rejected, parent never sees pending/cancelled-unapproved courses.
- [ ] Step 2: integration (supertest + real DB): `GET /courses` as parent matches seeded approved courses; teacher `POST /courses` appears pending and not in the parent list; admin01 approval makes it appear; capacity below booked returns `capacity_below_booked`; cancel returns the refund count and creates `refund_reports` rows.
- [ ] Step 3: frontend integration (stubbed): gateway paths/verbs/bodies match the contract; errors surface their code.
- [ ] Step 4: run, expect FAIL; implement; run, expect PASS. Commit.

### Task 5: Bookings group

**Files:** Backend `entities/booking.ts`, `interfaces/booking-repository.ts`, `use-cases/bookings.ts`, `adaptor/supabase/booking-repository.ts`, `adaptor/http/bookings.routes.ts`. Frontend `adaptor/http/bookings-gateway.ts` (+ replace `my-bookings-gateway.ts`, `course-roster-gateway.ts`), `interfaces`, `use-cases/{book-seat,load-booking}.ts`.
**Interfaces:** `bookSeat(actor, {courseId, studentName}): BookingDto` (calls `book_seat` RPC as the user; empty name -> `student_name_required`); `myBookings(actor): BookingDto[]` (with course, payments, proofs); `getBooking(actor, id)` (owner only, else `booking_not_found`; used by the receipt page); `courseRoster(actor, courseId): RosterRowDto[]` (course teacher or admin; signed proof URLs only for admin01 per existing policy, else `null`); `activeBookings(actor)` for the course cards (`held|paid` of the actor).

- [ ] Step 1: unit tests (fake repo): ownership, roster authorization (other teacher -> `forbidden`), empty name, `holdsSeat` marks shown for the course list.
- [ ] Step 2: integration: the existing r1 overbooking scenarios run through `POST /bookings` (20 concurrent parents, one seat -> exactly one 201, rest `course_full`), `already_booked`, `registration_closed`; `GET /bookings/mine` returns only the caller's rows; roster of another teacher's course is 403.
- [ ] Step 3: frontend integration (stubbed): `book` posts `{courseId,studentName}`; `load` merges nothing client-side (server returns proofs joined).
- [ ] Step 4: FAIL, implement, PASS, commit.

### Task 6: Payments group

**Files:** Backend `interfaces/{proof-storage,payment-repository}.ts`, `use-cases/payments.ts`, `adaptor/supabase/{proof-storage,payment-repository}.ts`, `adaptor/http/payments.routes.ts`. Frontend `adaptor/http/payments-gateway.ts` (replaces `payment-proof-gateway.ts`, `payment-system-gateway.ts`), re-point `use-cases/{submit-payment-proof,load-payment-system}.ts`.
**Interfaces:** `submitProof(actor, bookingId, {contentType, bytes}): void` (type/size rules from Global Constraints, owner only, booking must be `held`; replaces an earlier proof and removes the old object; removes the new object if the DB write fails); `confirmPayment(actor, bookingId): void` (`confirm_transfer_payment` RPC as the user; idempotent when already paid); `paymentOverview(actor): { courses, refunds }` (role admin). HTTP: `PUT /bookings/:id/proof` with `express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '5mb' })`.

- [ ] Step 1: unit tests: wrong MIME -> `proof_type_invalid`; 5 MiB + 1 -> `proof_size_exceeded`; non-owner -> `booking_not_found`; storage cleaned when repo throws; replace removes old object.
- [ ] Step 2: integration (port of the existing r2 file through HTTP): attach then confirm -> paid + one receipt `RC-YYYYMMDD-nnnnnn`; confirm without proof -> `payment_proof_required`; another user confirming -> `booking_not_found`; 5 parallel confirms -> one payment; repeat confirm -> 200 and still one payment; `pay_booking` stays `bank_transfer_only`.
- [ ] Step 3: frontend integration (stubbed): `submit` sends the file bytes with its content type; `load` maps `{courses,refunds}`.
- [ ] Step 4: FAIL, implement, PASS, commit.

### Task 7: Auto-refresh over the API

**Files:** Modify `apps/frontend/src/lib/use-auto-refresh.ts`; Test `apps/frontend/tests/unit/use-auto-refresh.test.ts`.
**Interfaces:** `useAutoRefresh(refresh)` keeps the 15 s interval and the refresh-on-visible behaviour, drops the Supabase channel and the table arguments (callers updated).

- [ ] Step 1: failing test (fake timers, jsdom-free: extract the timer logic into a pure `createAutoRefresh(refresh, {intervalMs, isVisible})`): ticks every 15 s, refreshes when visibility returns, stops on dispose.
- [ ] Step 2: FAIL; implement; PASS; commit.

### Task 8: Frontend pages onto gateways, remove supabase-js

**Files:** Modify `pages/{CoursesPage,AdminPage,TeacherPage,MyBookingsPage,ReceiptPage}.tsx`, `lib/supabase.ts` (delete; types move to `entities`), `app/deps.ts`, `entities/*` (re-export contract types), `package.json` (remove `@supabase/supabase-js`); update `tests/integration/*` stubs and `tests/unit/layering.test.ts` (forbid `@supabase` everywhere in frontend src).
**Interfaces:** Consumes every use case from Tasks 3-6 via `app/deps.ts`; pages keep their current props, text and styling (`.styles.ts`).

- [ ] Step 1: failing tests: layering test forbids `@supabase` in `apps/frontend/src` (fails today); a page-level smoke per page is covered by e2e (Task 9).
- [ ] Step 2: migrate page by page, replacing each `supabase.*` call with its use case; keep optimistic updates and toasts identical.
- [ ] Step 3: `npm run build`, `tsc`, frontend unit + integration pass. Commit.

### Task 9: Cross-app integration, e2e, security review, docs

**Files:** `tests/integration/*.test.ts` (rewrite to call the frontend `http` gateways against the running API), `tests/e2e/{auth,booking,payment,teacher,admin}.spec.ts`, `tests/playwright.config.ts` (starts API + frontend), `AGENTS.md`, `README.md`, `TEST_PLAN.txt`.

- [ ] Step 1: failing tests: integration signs in through `apiClient` and asserts the DTO shapes; e2e specs (role/label locators): parent books -> attaches proof -> confirms -> sees receipt; teacher submits a course -> admin01 approves -> parent sees it; admin cancels a paid course -> refund shown; wrong password shows the Thai error; expired token recovers.
- [ ] Step 2: FAIL; fix wiring; `task test` passes at every level.
- [ ] Step 3: security review (separate agent): JWT verification path, role checks on every route, upload validation, CORS origin, no secrets in logs or the frontend bundle (`grep` the build for the service key), error messages do not leak SQL. Fix findings with tests.
- [ ] Step 4: docs updated (AGENTS.md architecture + test table, README commands, TEST_PLAN). Commit.

### Task 10: Fern docs as the single source of truth

**Files:** Create `docs/package.json` (devDependency `fern-api`), `docs/fern/{fern.config.json,generators.yml,docs.yml}`, `docs/fern/openapi/openapi.json` (generated, committed), `docs/fern/pages/*.mdx` (overview, architecture, authentication, api-conventions, frontend, backend, testing, running-locally, notes-index), `docs/notes/` (living dated notes), `apps/backend/scripts/gen-openapi.ts`; Modify root `Taskfile.yml`, `AGENTS.md`, `apps/backend/package.json`; Fill `apps/backend/src/adaptor/http/endpoints/auth.ts` (+ a `/health` entry); Test `apps/backend/tests/unit/openapi.test.ts`.
**Interfaces:** Consumes the endpoint registry `endpoints` (`adaptor/http/endpoints`, type `Endpoint`) and the zod schemas in `contract.ts`. Produces `buildOpenApi(endpoints): OpenApiDocument` (OpenAPI 3.1; `z.toJSONSchema` for schemas, the `Envelope` wrapper on every success and failure response, bearer security scheme, one tag per group, error codes in the operation description) and `npm run docs:openapi` writing `docs/fern/openapi/openapi.json`.

- [ ] Step 1: failing tests: (a) the generated document equals the committed `openapi.json` (a stale spec fails the test and the message says to run `task docs:openapi`); (b) every route actually mounted on `createApp(...)` (walk the Express router stack) has exactly one registry entry with the same method and path, and every registry entry is mounted; (c) every entry has a non-empty summary, an `operationId` that is unique, and error codes listed; (d) the document validates structurally (openapi/info/paths/components present, every `$ref` resolves).
- [ ] Step 2: run, expect FAIL.
- [ ] Step 3: implement `gen-openapi.ts` + auth/health registry entries; add Fern config (`organization: seatsure`, OpenAPI as the API definition, a docs navigation with the guide pages and the API reference); `task docs:openapi`, `task docs:check` (`fern check`), `task docs:dev` (`fern docs dev` in `docs/`), `task docs` (generate + check).
- [ ] Step 4: write the guide pages from the real code (no invented behaviour): what each app does, Clean Architecture layers and the import rules, authentication flow (login/refresh/logout, middleware, session storage), response envelope and error codes, test levels and commands (including Vitest UI), running locally (`task up/down/test`), and a "Notes" page explaining `docs/notes/`. Existing `docs/superpowers/{specs,plans}` stay where they are and are linked, not copied.
- [ ] Step 5: `AGENTS.md` gets a "Docs are the source of truth" section: read `docs/` (Fern pages and `docs/notes/`) before starting any task; after any change write or update the relevant page, or add a dated note `docs/notes/YYYY-MM-DD-<topic>.md`; API changes go through the endpoint registry and `task docs:openapi`; docs and the generated spec are part of the definition of done.
- [ ] Step 6: `fern check` passes (run `npx fern-api check` in `docs/`), tests pass, `fern docs dev` starts (smoke, then stop). Commit.

## Self-review notes

- Spec coverage: backend layers (T1,T3-6), contract (T2), frontend middleware (T3), polling (T7), page migration + supabase-js removal (T8), test matrix and e2e (every task + T9), cleanup (T1), security review (T9).
- Type consistency: DTOs come from `contract.ts` only; use-case names above are the ones tasks 3-8 reference (`signIn`, `listCourses`, `bookSeat`, `submitProof`, `confirmPayment`, `paymentOverview`).
