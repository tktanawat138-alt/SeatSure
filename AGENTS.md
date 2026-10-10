# SeatSure: agent rules

## Layout and commands

- `apps/frontend/` React app, `apps/frontend/src/` and `apps/frontend/tests/` below live here. `apps/backend/` Express API (`src/`, Clean Architecture; business rules live here, the frontend talks only to it) plus local Supabase (`supabase/` migrations, RLS, RPC) and `scripts/` (env, seed, OpenAPI generator). `docs/` Fern docs project (`docs/fern/`) and dated notes (`docs/notes/`).
- `task up` start Supabase + API (3001) + frontend (5173). `task down` stop all. `task test` run unit, integration, e2e (or `task test:unit` etc.).
- Schema changed: `task backend:types`. Rebuild DB: `task backend:reset`.
- Docs: `task docs:openapi` (regenerate the API spec), `task docs:check` (`fern check`), `task docs:dev` (local preview), `task docs` (openapi + check).

## Docs are the single source of truth

The docs are Fern (`docs/fern/`): guide pages in `docs/fern/pages/*.mdx` and an API reference generated from code.
`docs/notes/` holds dated notes. Detail lives there; this file only points to it.

- Before starting ANY task, read the relevant pages under `docs/fern/pages/` and the latest notes in `docs/notes/`.
- After ANY change, update the relevant page, or add a dated note `docs/notes/YYYY-MM-DD-<topic>.md` (what, why, decisions, caveats). List new notes in `docs/fern/pages/notes-index.mdx`.
- API changes go through the endpoint registry (`apps/backend/src/adaptor/http/endpoints/`) and the zod schemas in `adaptor/http/contract.ts`, then `task docs:openapi`. A stale `docs/fern/openapi/openapi.json` fails `apps/backend/tests/unit/openapi.test.ts`. Never edit that JSON by hand.
- Docs and the regenerated spec are part of the definition of done. `task docs:check` must pass.
- If code and docs disagree, fix whichever is wrong in the same change.
- Design history stays in `docs/superpowers/{specs,plans}`; link it, do not copy it.

React 19 + Vite + Tailwind v4 + shadcn/ui (radix-nova) on Supabase. Architecture and tests follow the
GS Battery SOP, AI Engineering section 7.2 (Clean Architecture), adapted to TypeScript:
https://github.com/Siam-GS-Battery/agent-skill (`sop/ref/07_AI_ENGINEERING/7.2_Clean_Architecture_Backend.md`).

## Frontend: shadcn/ui only

- Build every screen from the reusable components in `apps/frontend/src/components/ui/` (shadcn). Do not hand-roll
  a button, input, dialog, table, select, badge, card, etc.
- Missing a primitive? Add it with `npx shadcn@latest add <name>`. Do not write a lookalike.
- Compose, don't fork: feature components (`apps/frontend/src/components/<feature>/`) wrap `ui/*`; they do not
  restyle or copy them. Edit a `ui/*` file only to change the design system for the whole app.
- Tailwind theme tokens live in `apps/frontend/src/index.css`. No inline hex colors, no other UI library.

## Frontend: styling goes through CVA, never inline in TSX

Goal: a component file reads as structure, not a wall of utility classes.
Docs: https://cva.style/

- Do not write Tailwind class strings in `.tsx`/`.ts` component code: no `className="flex gap-2 ..."`, no `cn('...', cond && '...')`, no `Record<Tone, string>` class maps, no `style={{}}`.
- Every class string lives in a sibling `<name>.styles.ts` built with `cva` (`class-variance-authority`, already installed). The TSX only calls it.
- Variants (tone, size, state) become cva `variants`, with `defaultVariants`. Booleans/conditions become variants too, not ternaries on class strings.
- A static layout element with no variants is still a `cva('...')` (or a named const in `.styles.ts`), so the TSX stays class-free.
- Export props types with `VariantProps<typeof x>`; do not retype the variant unions by hand.
- Allowed in TSX: passing a `className` prop through to a `ui/*` component, and calling styles functions: `className={card({ tone })}`.
- `ui/*` (shadcn) files keep their own `cva` inline; they are the design system. Everything else follows the rule above.

```ts
// status-badge.styles.ts
import { cva, type VariantProps } from 'class-variance-authority'

export const dot = cva('size-1.5 rounded-full bg-current')
export const badge = cva('', {
  variants: {
    tone: {
      ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      warn: 'border-amber-200 bg-amber-50 text-amber-800',
      bad: 'border-red-200 bg-red-50 text-red-700',
      muted: 'border-transparent bg-muted text-muted-foreground',
    },
  },
  defaultVariants: { tone: 'muted' },
})
export type BadgeProps = VariantProps<typeof badge>
```

```tsx
// status-badge.tsx
export function StatusBadge({ tone, children }: BadgeProps & { children: ReactNode }) {
  return (
    <Badge variant="outline" className={badge({ tone })}>
      <span className={dot()} aria-hidden />
      {children}
    </Badge>
  )
}
```

- cva does not merge conflicting Tailwind utilities (no `tailwind-merge`). Do not pass a `className` that overrides a utility already set by the style function; add a variant instead.
- `apps/frontend/tests/unit/styles.test.ts` fails on literal `className="..."`, `cn(` or `style={{` in any `.tsx` outside `src/components/ui/`.
- Icons come from `lucide-react`; toasts from `sonner` via `ui/sonner`.

## Source layout (Clean Architecture)

Dependencies point inwards. A layer may import only the layers listed in "May import".

| Layer | Path | Holds | May import |
|---|---|---|---|
| Entities | `apps/frontend/src/entities/` | domain types, pure rules (`holdIsLive`, `bookingStatus`), `DomainError` | nothing |
| Interfaces | `apps/frontend/src/interfaces/` | ports: types the use cases need (`CourseRepository`, `BookingGateway`) | entities |
| Use cases | `apps/frontend/src/use-cases/` | app logic, one function/class per action (`bookSeat`, `payBooking`), ports passed in | entities, interfaces |
| Adaptor | `apps/frontend/src/adaptor/<system>/` | implements ports: `http/` (API client middleware, session store, gateways), `format/`. `supabase/` is legacy and goes away with supabase-js | entities, interfaces |
| UI | `apps/frontend/src/ui/` (pages, feature components, hooks) | React; calls use cases via hooks | use-cases, entities, `components/ui` |
| Composition root | `apps/frontend/src/main.tsx`, `apps/frontend/src/app/deps.ts` | the only place that wires adaptor into use cases | everything |

- No `react` or `@supabase/*` in `entities`, `interfaces`, `use-cases`. New data access goes through `adaptor/http/` to the backend API, never to Supabase.
- Backend (`apps/backend/src/`) uses the same layers: `entities/`, `interfaces/` (ports), `use-cases/`, `adaptor/http/` (routers, guard, contract, endpoint registry) and `adaptor/supabase/`, wired only in `app.ts`/`main.ts`. `entities`, `interfaces`, `use-cases` import no `express` or `@supabase/*` (`apps/backend/tests/unit/layering.test.ts`). Details: `docs/fern/pages/architecture.mdx`, `backend.mdx`.
- A port exists only if there is a second implementation (a fake for tests) or the contract may change. Otherwise the adaptor is the contract.
- Use cases throw `DomainError(code)`; the UI maps codes to Thai messages.
- `apps/frontend/tests/unit/layering.test.ts` enforces the boundaries. Keep it green.
- Existing code in `apps/frontend/src/lib`, `apps/frontend/src/pages`, `apps/frontend/src/components` predates this layout. Move code into layers when you touch it; do not mix old and new in one file.

## Tests: per app (unit + integration), cross-app at the root (integration + e2e)

| Where | Level | Scope | Command |
|---|---|---|---|
| `apps/frontend/tests/unit/` | Unit | entities, use cases with fake ports. No DB, no network, no React | `task test:unit` |
| `apps/frontend/tests/integration/` | Integration, one app | real adaptors over a stubbed network (`stub-network.ts`) | `task test:integration:frontend` |
| `apps/backend/tests/unit/` | Unit | use cases with fake ports, routes via `createApp` + supertest with fakes, guard, layering, OpenAPI spec. No services | `task test:unit` |
| `apps/backend/tests/integration/` | Integration, one app | the API over HTTP against real local Supabase: RLS, RPC, concurrency | `task test:integration:backend` |
| `tests/integration/` | Integration, cross-app | frontend adaptors against the real backend: shapes and error codes the UI relies on | `task test:integration:cross` |
| `tests/e2e/` | E2E | browser through the running app, Playwright is the core service (`tests/playwright.config.ts`) | `task test:e2e` |

- `task test` runs every level. Vitest UI (https://vitest.dev/guide/ui): `task test:ui:frontend`, `task test:ui:backend`, `task test:ui:cross` (`@vitest/ui`, `vitest --ui` in each package). Each folder has its own `package.json`/vitest config.
- Rule for "integration": inside an app = that app plus one real dependency. At the root = two apps wired together. Do not re-test backend rules at the root; test only the contract the frontend depends on.
- Mirror the layer: a use case test goes in `apps/frontend/tests/unit/use-cases/` or `apps/backend/tests/unit/use-cases/`.
- Write the failing test first (TDD), then the code.
- Name tests `<unit> <scenario> <expected>`. No `sleep`; wait on a condition.
- Unit and frontend integration tests need no `.env.local`. Backend, cross-app and e2e need `task up` first.
- E2E: Playwright only (`@playwright/test`), specs named `tests/e2e/<flow>.spec.ts`. Locate by role/label, not CSS. First run installs Chromium.
