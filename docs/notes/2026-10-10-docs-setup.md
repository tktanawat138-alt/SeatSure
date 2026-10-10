# Docs setup: Fern as the single source of truth (2026-10-10)

## What

- `docs/` is a Fern project (`docs/fern/`): `fern.config.json` (organization `seatsure`), `generators.yml` (API
  definition `openapi/openapi.json`), `docs.yml` (navigation: guide pages, then the API reference).
- Guides are `docs/fern/pages/*.mdx`, written from the code. The API reference is rendered from
  `docs/fern/openapi/openapi.json`, which is **generated and committed**.
- Generator: `apps/backend/scripts/gen-openapi.ts` (`buildOpenApi(endpoints)`), run by `task docs:openapi`
  (`npm run docs:openapi` in `apps/backend`). No extra dependency: OpenAPI 3.1 is built by hand, schemas come from
  `z.toJSONSchema` (zod 4).
- Tasks: `task docs:openapi`, `task docs:check` (`fern check`), `task docs:dev` (`fern docs dev`, http://localhost:3000),
  `task docs` (openapi + check). The Fern CLI is the `fern-api` devDependency in `docs/package.json`, run with `npx`.
- Guard: `apps/backend/tests/unit/openapi.test.ts`.

## Why

One place to read before a task and to update after it. The HTTP surface is declared once (the endpoint registry plus the
zod contract), so the reference cannot drift from the routes: the test fails when a route has no entry, an entry has no
route, or the committed JSON is stale.

## Decisions

- The registry entry (`method`, `path`, `operationId`, `summary`, `description`, `tag`, `auth`, `request`, `response`,
  `errors`) is the only hand-written API description. The generator adds validation 400, 401 (non-public) and 403 (role
  list) to the error list automatically, wraps every `data` in the success envelope and every failure in the `Failure` schema.
- Every exported zod schema of `contract.ts` becomes a named component (`CourseDto` -> `Course`), so responses use `$ref`.
  New DTOs are picked up without changing the generator. The date-time `pattern` and the safe-integer `maximum` that zod
  adds are dropped as noise. zod `.refine` rules are not representable in JSON Schema; describe them in the entry's
  `description`.
- Success status is always 200; a non-JSON `request.contentType` with an empty schema becomes `string/binary`.
- The route walk in the test reads the Express 5 router stack (`app.router.stack`) and assumes routers are mounted at the root
  (`app.use(router)`), as `app.ts` does. A router mounted under a prefix would show up as a missing entry.
- `docs.yml` uses `skip-slug: true` on the Guides section (pages live at `/overview`, `/backend`, ...) and
  `check.rules.broken-links: error`.

## Caveats

- Hosting and publishing (`fern generate --docs`) need a Fern account and are out of scope. `fern check` and `fern docs dev`
  ran without login; `check` only warns that the redirects check is skipped when not authenticated. `fern docs dev`
  downloads its preview bundle on first run (a few minutes) and serves on port 3000.
- `docs.yml` `instances.url` (`seatsure.docs.buildwithfern.com`) is a placeholder until an organization is registered.
- `fern.config.json` pins the CLI version (`5.152.2`) to match `docs/package.json`; bump both together.
- The status table in `api-conventions.mdx` mirrors `adaptor/http/error-handler.ts`; update the page when `statusOf` changes.
- The frontend guide describes the target layout; some pages still read through legacy `adaptor/supabase` until the page migration
  finishes.
