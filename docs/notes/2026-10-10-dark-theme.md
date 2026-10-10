# Dark theme and smooth components (2026-10-10)

## What

- Theme choice `light` / `dark` / `system` (default `system`), saved in `localStorage` key `seatsure-theme`.
  Pure logic in `apps/frontend/src/lib/theme.ts` (`resolveTheme`, `readStoredTheme`, `storeTheme`,
  `createThemeStorage`, `applyTheme`), React wiring in `src/lib/theme-provider.tsx` (`ThemeProvider`, `useTheme`, mounted
  in `src/main.tsx`), and `src/components/theme-toggle.tsx` (shadcn `dropdown-menu`, Sun / Moon / Monitor icons, Thai
  labels `สว่าง`, `มืด`, `ตามระบบ`, `aria-label` `เปลี่ยนธีม`). The toggle is in the app shell header (before the logout
  button) and in the top-right corner of the login page.
- No flash: an inline script in `index.html` adds `dark` to `<html>` before React loads. A unit test runs that script
  against `resolveTheme` so the two cannot drift. `color-scheme` is set in `index.css` (`:root` light, `.dark` dark).
- `system` listens to `matchMedia('(prefers-color-scheme: dark)')` and updates live.
- Status colours (`status-badge`, seat meter bar, roster warning) have `dark:` pairs. The `LoginPage` brand panel keeps the
  light-theme brand pair inside its subtree in dark mode (local `--primary` and `--primary-foreground`).
- Motion, all behind `motion-reduce:` utilities: `ui/button` (colour, press `scale-[0.98]`), `ui/badge`, `ui/input`,
  `ui/textarea`, `ui/select` trigger (colour and focus-ring transition), `ui/switch`, `ui/table` row hover,
  `ui/progress` fill, nav link hover, body background cross-fade (`duration-300`), page content fade and slide on route
  change (the content wrapper is keyed by pathname), theme icon pop. Skeleton keeps `animate-pulse` (off under reduced motion).
  `index.css` has a `prefers-reduced-motion: reduce` safety net that zeroes transition and animation durations, which
  also covers shadcn dialogs, dropdowns and spinners.

## Tokens and contrast (WCAG 2.x, computed from `src/index.css`)

Shadcn already shipped a `.dark` set and `@custom-variant dark`. Changed: dark `--primary`, `--primary-foreground`,
`--ring`, `--input`, `--sidebar-primary*`, and light `--muted-foreground`.

| Pair | Light | Dark | Needs |
|---|---|---|---|
| foreground / background | 19.79 | 18.96 | 4.5 |
| foreground / card (popover same) | 19.79 | 17.16 | 4.5 |
| primary-foreground / primary | 6.54 | 6.80 | 4.5 |
| secondary-foreground / secondary | 16.42 | 14.48 | 4.5 |
| accent-foreground / accent | 16.42 | 14.48 | 4.5 |
| muted-foreground / background | 5.51 | 7.63 | 4.5 |
| muted-foreground / card | 5.51 | 6.91 | 4.5 |
| muted-foreground / muted | 5.05 | 5.83 | 4.5 |
| destructive (text) / background | 4.76 | 6.84 | 4.5 |
| destructive (text) / card | 4.76 | 6.19 | 4.5 |
| primary (text, links) / background | 6.82 | 6.80 | 4.5 |
| primary (text) / card | 6.82 | 6.16 | 4.5 |
| ring (focus) / background | 3.76 | 5.26 | 3 |
| ring / card | 3.76 | 4.76 | 3 |
| input (control border) / background | 1.26 (see caveats) | 3.59 | 3 |
| input / card | 1.26 (see caveats) | 3.25 | 3 |
| brand panel text at 80% / primary | 4.72 | 4.72 (light pair kept) | 4.5 |
| status ok (emerald 700 on 50 / 300 on 950) | 5.09 | 9.98 | 4.5 |
| status warn (amber 800 on 50 / 300 on 950) | 6.88 | 10.37 | 4.5 |
| status bad (red 700 on 50 / 300 on 950) | 5.88 | 8.40 | 4.5 |

`tests/unit/contrast.test.ts` recomputes these (oklch to sRGB, alpha composited) and fails below the minimum.

## Decisions

- Dark `--primary` is a lighter blue (`oklch(0.68 0.17 257)`) with near-black foreground, replacing shadcn's grey. White on
  a blue that is also readable as text on `#0a0a0a` is impossible (needs luminance at most 0.18 and at least 0.21), so the
  foreground flips. The brand panel therefore overrides the pair locally to stay deep blue.
- Dark `--input` is a solid mid grey (`oklch(0.52 0 0)`, 3:1) instead of 15% white (about 1.5:1), so field and outline
  button edges are identifiable. `--border` (10% white, card rings and dividers) stays decorative.
- Light `--muted-foreground` `0.556` to `0.52` and brand panel small text `/70`, `/75` to `/80`: they were 4.34:1 and
  3.96:1, below AA. The visual change is not noticeable.
- The body colour cross-fade does not run on first paint (the inline script sets the class before CSS applies). Only the
  body background fades; cards switch instantly. A full-page fade would need a transition on every element.
- `ThemeToggle` is a ghost icon button with a radio menu, so Enter or Space opens it, arrows move, Escape closes.

## Caveats

- Light-mode control borders stay at shadcn's 1.26:1 (`--input` `oklch(0.922 0 0)`): raising them would change the light
  look, which this task keeps. Fields remain identifiable by label and fill only. Same for light outline buttons.
- The seat meter bar in light mode (`amber-500` on the track) is 1.97:1; the count next to it carries the information.
  In dark it is `amber-400` (8.8:1).
- `docs/fern/pages/notes-index.mdx` was not edited (not owned by this task); add this note to its table.
- Tests: `tests/unit/theme.test.ts`, `contrast.test.ts`, `dark-variants.test.ts`; Playwright `tests/e2e/theme.spec.ts`
  (needs only the dev server).
