# 2026-10-10 Quality metrics dashboard (sample data)

## What

Added the admin-only page `/quality` ("คุณภาพระบบ"): the four DORA metrics with level and direction, weekly trend charts,
defect density per module, and a table of where each number would come from once real data is connected. It answers
capstone part 3, item 2 (a mock dashboard for executive reporting). `TEST_PLAN.txt` section 9 defines the metrics and
levels in Thai.

| Layer | File |
|---|---|
| Entities | `apps/frontend/src/entities/quality-metrics.ts`: types and the rules (`doraLevel`, `trendOf`, `densityTone`, `buildQualityDashboard`) |
| Interfaces | `apps/frontend/src/interfaces/quality-metrics-gateway.ts` |
| Use cases | `apps/frontend/src/use-cases/load-quality-dashboard.ts` |
| Adaptor | `apps/frontend/src/adaptor/sample/quality-metrics-gateway.ts`: fixed sample records, 12 weeks |
| UI | `apps/frontend/src/ui/pages/QualityPage.tsx`, `apps/frontend/src/ui/quality/*` |

Tests: `apps/frontend/tests/unit/entities/quality-metrics.test.ts`,
`apps/frontend/tests/unit/use-cases/load-quality-dashboard.test.ts`, `tests/e2e/quality-dashboard.spec.ts`.

## Decisions

- Every number on the page is sample data and the page says so. Real history was too thin to chart (5 CI runs on one
  day, no bug issues, manual deploys). The one real anchor is code size from SonarQube Cloud, 4.75 KLOC of
  `apps/frontend/src` on 2026-10-10; the sample module sizes add up to it.
- This is the one place the frontend does not go through `adaptor/http/`: there is no backend endpoint, the adaptor is
  an in-memory sample. The adaptor returns raw records and the entity rules compute every metric, so a real source
  (GitHub Actions, GitHub Issues, SonarQube, most likely behind a backend endpoint) replaces one file.
- DORA levels are numeric cut-offs adapted from the 2023 State of DevOps report. The defect density targets (ok up to
  1.0 per KLOC, warn up to 2.0) are the project's own.
- The page is loaded on demand (`lazy` in `App.tsx`) so `recharts` stays out of the main bundle. Charts use the shadcn
  `chart` primitive; `--chart-1..5` in `index.css` changed from greys to a validated categorical palette.

## Caveats

- No automatic collection of real data exists. `quality-metrics.json` and the CI-level metrics in `TEST_PLAN.txt`
  section 9 are still a plan.
- Records dated outside the period are not filtered by `buildQualityDashboard`; the sample data has none.
- Design history: `docs/superpowers/specs/2026-10-10-quality-dashboard-design.md` and
  `docs/superpowers/plans/2026-10-10-quality-dashboard.md`. Both predate the backend API split; where they mention
  `apps/frontend/tests/e2e/` or Supabase sign-in, this note and the code are current.
