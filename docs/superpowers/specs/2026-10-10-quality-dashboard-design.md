# Quality Metrics Dashboard: design

Date: 2026-10-10. Approved in chat by the project owner.

## Goal

Capstone part 3, item 2: a mock dashboard that tracks DORA metrics and defect
density for executive reporting. It is a page inside the SeatSure app, visible
to the `admin` role only, at `/quality` ("คุณภาพระบบ").

Success: an admin opens the page and reads, without explanation, the four DORA
metrics with their level and direction, the defect density per module, and
where each number would come from once real data is connected. The page says
clearly that it shows sample data.

## Why sample data

Real history is too thin to chart: 5 CI runs on one day, no bug issues, manual
deploys. The one real anchor is code size from SonarQube Cloud, 4,750 lines
(4.75 KLOC) on 2026-10-10; the sample module sizes add up to that.

## Page content, top to bottom

1. Page header "คุณภาพระบบ" and an alert: sample data, period shown (12 weeks).
2. Four DORA cards: value, level badge (Elite/High/Medium/Low), direction
   against the earlier half of the period.
3. DORA weekly trend chart(s).
4. Defect density per module: bar chart and table (module, linked risk, KLOC,
   defects, density, tone), plus the overall figure.
5. Data sources table: metric, real source, how it is derived.

All visible text is Thai, except metric names that are terms of art
(Deployment Frequency, Lead Time for Changes, Change Failure Rate,
Time to Restore, Defect Density, Elite/High/Medium/Low).

## Architecture

Follows AGENTS.md. Dependencies point inwards.

| Layer | File | Holds |
|---|---|---|
| Entities | `src/entities/quality-metrics.ts` | types and the pure rules: `buildQualityDashboard(records)` and helpers |
| Interfaces | `src/interfaces/quality-metrics-gateway.ts` | `QualityMetricsGateway.loadRecords()` |
| Use cases | `src/use-cases/load-quality-dashboard.ts` | `createLoadQualityDashboard(gateway)` |
| Adaptor | `src/adaptor/sample/quality-metrics-gateway.ts` | fixed sample records |
| Composition | `src/app/deps.ts` | `loadQualityDashboard` |
| UI | `src/ui/pages/QualityPage.tsx`, `src/ui/quality/*` | page and feature components, each with a `.styles.ts` |

The port is justified: tests use a fake, and the sample adaptor is meant to be
replaced by one that reads GitHub Actions, GitHub Issues and SonarQube.

The adaptor returns raw records (deployments, defects, module sizes). Every
metric is computed by the entity rules, so switching to real data changes one
file.

## Rules

The period is split at its midpoint: "current" is the later half, "previous"
the earlier half. A card shows the current value; direction compares it with
the previous value.

| Metric | Value | Better when |
|---|---|---|
| Deployment Frequency | deployments per week | higher |
| Lead Time for Changes | median `leadTimeHours` | lower |
| Change Failure Rate | failed / total deployments, percent | lower |
| Time to Restore | median `restoreMinutes` of failed deployments | lower |

- Direction is `flat` when the relative change is under 5%, otherwise `better`
  or `worse`. `null` when either half has no value.
- A metric with no data has value `null` and level `null`; the UI shows "N/A",
  never 0.

Levels, adapted from the 2023 State of DevOps report:

| Metric | Elite | High | Medium | Low |
|---|---|---|---|---|
| Deployment Frequency (per week) | >= 7 | >= 1 | >= 0.25 | below |
| Lead Time (hours) | < 24 | < 168 | < 720 | above |
| Change Failure Rate (%) | <= 5 | <= 10 | <= 15 | above |
| Time to Restore (minutes) | < 60 | < 1440 | < 10080 | above |

Defect density = defects / KLOC, per module and overall. Tone: `ok` up to 1.0,
`warn` up to 2.0, `bad` above. These targets are the project's own choice. A
module with 0 KLOC has density `null` and tone `null`.

Weekly trend: one row per week (Monday start) in the period, with deployments,
median lead time, change failure rate and median restore time; `null` where a
week has no data.

## Sample data

Deterministic: no `Math.random`, no `Date.now`. Period 2026-07-20 to
2026-10-11 (12 weeks). Modules and sizes (KLOC, sum 4.75):

| id | name | risk | KLOC |
|---|---|---|---|
| booking | จองที่นั่ง | R1 | 1.20 |
| payment | ชำระเงิน | R2 | 1.35 |
| access | สิทธิ์เข้าถึง | null | 0.95 |
| admin | จัดการคอร์ส | null | 1.25 |

The story the data tells: delivery improves over the period (more frequent
deploys, shorter lead time, fewer failures), and the payment module has the
highest defect density.

## Tests

- Unit, written first: `tests/unit/entities/quality-metrics.test.ts` (levels at
  each boundary, medians, direction, N/A, density and tone, weekly rows) and
  `tests/unit/use-cases/load-quality-dashboard.test.ts` with a fake gateway.
- E2E: `tests/e2e/quality-dashboard.spec.ts` signs in as the seeded admin,
  opens the page from the nav, and checks the four metric names, the sample
  data notice and the density table. Locate by role and label.
- `tests/unit/layering.test.ts` and `tests/unit/styles.test.ts` stay green.

## Out of scope

Reading real data from GitHub or SonarQube, date-range filters, export, and
any change to roles or the database.
