# System architecture and sequence diagrams, 2026-10-11

## What

Two new guide pages, drawn from the code (not from older docs):

- `docs/fern/pages/system-architecture.mdx`: context, containers, backend and frontend layers, the registry-to-Fern
  pipeline, ER diagram of every table with constraints, SQL functions and triggers, trust zones, which Supabase key each
  client uses, local runtime topology, a component table, cross-cutting concerns, decisions and known gaps.
- `docs/fern/pages/sequence-diagrams.mdx`: login, refresh, logout, browse courses per role, propose and approve a course,
  book a seat (with the 20-user race), upload proof and confirm payment, cancel with refunds, roster and the admin01 signed
  URL, the API request pipeline, `task up`, `task test` and the CI jobs. Each diagram has a step table with code paths and
  the check made at each step.

22 Mermaid diagrams; every one was parsed and rendered with Mermaid 11 in Chromium before commit. Fern renders
```` ```mermaid ```` fences.

## Discrepancies found (code wins; other pages not edited)

| Page | Says | Code |
|---|---|---|
| `architecture.mdx` | "the backend talks to Supabase with the service key" | mixed: the service key is used for token verify, profiles, course and booking reads, roster and signed URLs; course writes, `cancel_course`, `book_seat` and the whole payments group run with the anon key plus the user's token (`*-repository.ts`, `payments-wiring.ts`) |
| `architecture.mdx`, `backend.mdx`, `AGENTS.md` | `createApp` is the only place that connects adaptors to use cases | each router builds its own use case from the ports it receives (`createCourses(deps.courseRepository)` in `courses.routes.ts`, same in the other routers) |
| `architecture.mdx` | the frontend never calls Supabase | true for API calls, but admin01 opens proof images through a Supabase Storage signed URL (600 s) from `roster-dialog.tsx` |
| `api-conventions.mdx` | `studentName` is bounded to 200 characters | `POST /bookings` parses `BookSeatBody.extend({ studentName: z.string() })` (`bookings.routes.ts`), which drops the `max(200)`; no bound is enforced on that route |
| `Taskfile.yml` `backend:up` description | writes `apps/frontend/.env.local` | `write-env.mjs` writes both `apps/frontend/.env.local` and `apps/backend/.env.local` |
| (migrations) | polling, no Realtime | `20261015000000_enable_realtime_refresh.sql` still adds four tables to the `supabase_realtime` publication; `config.toml` disables Realtime, so it is unused |

## Caveats

- Cross-links assume the slugs `/system-architecture` and `/sequence-diagrams`; the navigation entries are added separately.
- `task test:integration:cross` depends only on `backend:up`, so the API on port 3001 must already run (`task up`).
- CI runs `unit`, `integration-e2e`, `docs` and `sonar` as parallel jobs with no `needs`; Sonar does not wait for the tests.
- The teacher screen lists students from `GET /bookings/active`; `GET /courses/:id/roster` is used by the admin pages.
