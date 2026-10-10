# Auto-refresh over the API (Task 7), 2026-10-10

## What

`apps/frontend/src/lib/use-auto-refresh.ts` no longer imports Supabase. Realtime events are gone with supabase-js; what stays is the polling half of the old behaviour: a refresh every 15 s and one when the tab becomes visible again.

- `createAutoRefresh(refresh, { intervalMs, isVisible, onVisibilityChange })` is the pure timer logic. It returns `{ dispose() }`. No React, no DOM, so `tests/unit/use-auto-refresh.test.ts` runs it with fake timers in the node environment.
- `useAutoRefresh(refresh)` wraps it in an effect with cleanup. The effect subscribes once; a ref always points at the latest `refresh`, so a new callback each render does not resubscribe.

## Decisions

- A tick or visibility event is skipped while the previous `refresh` promise is pending, so a slow API never stacks requests.
- A refresh that throws or rejects is swallowed inside the loop (the caller reports its own errors) so later ticks still run and no unhandled rejection appears.
- Becoming hidden does not refresh. The interval keeps ticking while hidden, as before.
- The 250 ms debounce is gone: it only existed to coalesce realtime bursts.

## Caveats

- `useAutoRefresh` still tolerates `..._legacyTables: string[]` so callers that still pass table names compile. Remove it once every caller drops the list.
- Changes made by other users now show up within 15 s (or on tab focus) instead of within about 250 ms.
