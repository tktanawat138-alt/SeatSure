# Quality Metrics Dashboard Implementation Plan

> **For agentic workers:** The project owner chose parallel teammates for this plan. Tasks 1, 2 and 3 run at the same time on disjoint files; the lead does Tasks 0 and 4. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-only page `/quality` in the SeatSure app that shows sample DORA metrics and defect density for executive reporting.

**Architecture:** The sample adaptor returns raw records; pure entity rules turn them into a `QualityDashboard`; a use case exposes it through `src/app/deps.ts`; a React page renders it with shadcn components and CVA styles.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, shadcn/ui (radix-nova) incl. the `chart` primitive, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-quality-dashboard-design.md`

## Global Constraints

- Read `AGENTS.md` first. It overrides habits: shadcn only, every class string in a sibling `.styles.ts` built with `cva`, no `className="..."`, `cn(` or `style={{` in `.tsx`, no inline hex colors.
- Layering: no `react` or `@supabase/*` in `entities`, `interfaces`, `use-cases`; adaptor imports only entities and interfaces.
- All paths below are relative to `apps/frontend/` unless they start with `docs/` or `TEST_PLAN.txt`.
- Visible text is Thai, except: Deployment Frequency, Lead Time for Changes, Change Failure Rate, Time to Restore, Defect Density, Elite, High, Medium, Low.
- A metric with no data shows "N/A", never 0.
- Sample data is deterministic: no `Math.random`, no `Date.now`, no `new Date()` without an argument. Dates are handled in UTC.
- Shared working tree: teammates do NOT run `git add`, `git commit`, `git checkout`, `git stash` or `git reset`, and touch only the files their task lists. The lead commits.
- Do not start or stop Supabase, and do not kill the process on port 5173 (a stale server owned by the project owner). Use port 5174 for any dev server.
- Tests are named `<unit> <scenario> <expected>`. No `sleep`.

## Review Focus

1. No deployments at all: every DORA value, level and trend is `null`, weekly rows still exist with `deployments: 0`, nothing divides by zero. (Task 1 test)
2. Deployments but none failed: Change Failure Rate is `0` with level `elite`, Time to Restore is `null`. 0% is data, not N/A. (Task 1 test)
3. Deployments only in one half of the period: trend is `null`, not `better`. (Task 1 test)
4. A defect whose `moduleId` matches no module: counted in `overall`, in no module row. (Task 1 test)
5. Loading fails or a weekly value is `null`: the page shows `PageError`; charts leave a gap instead of drawing 0. (Task 2 step)

---

### Task 0: Contract (lead)

**Files:**
- Create: `src/entities/quality-metrics.ts` (types only), `src/interfaces/quality-metrics-gateway.ts`

**Interfaces, produced for Tasks 1 and 2:**

```ts
// src/entities/quality-metrics.ts
export type DoraLevel = 'elite' | 'high' | 'medium' | 'low'
export type DoraMetricKey = 'deploymentFrequency' | 'leadTime' | 'changeFailureRate' | 'timeToRestore'
export type Trend = 'better' | 'worse' | 'flat'
export type DensityTone = 'ok' | 'warn' | 'bad'
export type DefectSeverity = 'critical' | 'major' | 'minor'

export interface Deployment { id: string; deployedAt: string; leadTimeHours: number; failed: boolean; restoreMinutes: number | null }
export interface Defect { id: string; moduleId: string; severity: DefectSeverity; foundAt: string }
export interface CodeModule { id: string; name: string; risk: string | null; kloc: number }
export interface QualityRecords {
  periodStart: string // 'YYYY-MM-DD', inclusive, a Monday
  periodEnd: string   // 'YYYY-MM-DD', inclusive
  isSample: boolean
  deployments: Deployment[]
  defects: Defect[]
  modules: CodeModule[]
}

export interface DoraMetric { key: DoraMetricKey; value: number | null; previous: number | null; level: DoraLevel | null; trend: Trend | null }
export interface DoraWeek { weekStart: string; deployments: number; leadTimeHours: number | null; changeFailureRate: number | null; restoreMinutes: number | null }
export interface DensityRow { kloc: number; defects: number; density: number | null; tone: DensityTone | null }
export interface ModuleDensity extends DensityRow { moduleId: string; name: string; risk: string | null }
export interface QualityDashboard {
  periodStart: string
  periodEnd: string
  isSample: boolean
  dora: DoraMetric[]      // always 4, in DoraMetricKey order above
  weeks: DoraWeek[]
  modules: ModuleDensity[] // same order as records.modules
  overall: DensityRow
}

// src/interfaces/quality-metrics-gateway.ts
export interface QualityMetricsGateway { loadRecords(): Promise<QualityRecords> }
```

- [ ] Write both files, run `npx tsc --noEmit`, commit with the spec and this plan.

---

### Task 1: Domain (teammate "Domain")

**Files:**
- Modify: `src/entities/quality-metrics.ts` (add the functions below the types; do not change the types), `src/app/deps.ts`
- Create: `src/use-cases/load-quality-dashboard.ts`, `src/adaptor/sample/quality-metrics-gateway.ts`
- Test: `tests/unit/entities/quality-metrics.test.ts`, `tests/unit/use-cases/load-quality-dashboard.test.ts`

**Interfaces:**
- Consumes: Task 0 types and port.
- Produces:
  - `doraLevel(key: DoraMetricKey, value: number | null): DoraLevel | null`
  - `trendOf(key: DoraMetricKey, current: number | null, previous: number | null): Trend | null`
  - `densityTone(density: number | null): DensityTone | null`
  - `buildQualityDashboard(records: QualityRecords): QualityDashboard`
  - `createLoadQualityDashboard(gateway: QualityMetricsGateway): () => Promise<QualityDashboard>`
  - `sampleQualityMetricsGateway: QualityMetricsGateway`
  - in `src/app/deps.ts`: `export const loadQualityDashboard = createLoadQualityDashboard(sampleQualityMetricsGateway)`

**Rules (values from the spec):**
- Period length in days = `periodEnd - periodStart + 1`. Midpoint = `periodStart + length / 2` days. A deployment before the midpoint is "previous", otherwise "current". `value` is the current-half figure, `previous` the earlier-half figure.
- deploymentFrequency = deployments in the half / weeks in the half (`length / 2 / 7`). When the whole period has no deployments it is `null` for both halves; otherwise a half with none is `0` (level `low`). Its trend is `null` when either half has no deployments.
- leadTime = median `leadTimeHours`; changeFailureRate = failed / total * 100; timeToRestore = median `restoreMinutes` over failed deployments with a non-null value. Median of an even count is the mean of the two middle values. `null` when the half has nothing to compute from.
- Levels: deploymentFrequency `>= 7` elite, `>= 1` high, `>= 0.25` medium, else low. leadTime `< 24` elite, `< 168` high, `< 720` medium, else low. changeFailureRate `<= 5` elite, `<= 10` high, `<= 15` medium, else low. timeToRestore `< 60` elite, `< 1440` high, `< 10080` medium, else low. `null` in, `null` out.
- Trend: `null` if either value is `null`. Relative change `|current - previous| / previous` under 0.05 is `flat` (when `previous` is 0: `flat` if `current` is 0). Otherwise `better`/`worse`, where higher is better only for deploymentFrequency.
- Weeks: one row per 7 days from `periodStart` while the week start is `<= periodEnd`; `weekStart` as `'YYYY-MM-DD'`; `null` for a figure the week cannot compute.
- Density = defects / kloc; `kloc` 0 gives density and tone `null`. Tone `<= 1` ok, `<= 2` warn, else bad. `overall` uses all defects and the sum of module KLOC.

- [ ] **Step 1: Write the failing entity tests.** Build records inline in the test (a small `records()` helper with overrides). Cover at least:
  - `doraLevel` at every boundary in the table above, both sides (e.g. `doraLevel('changeFailureRate', 5)` is `'elite'`, `5.01` is `'high'`; `doraLevel('leadTime', 24)` is `'high'`), and `null` gives `null`.
  - `trendOf('deploymentFrequency', 2, 1)` is `'better'`; `trendOf('leadTime', 2, 1)` is `'worse'`; `trendOf('leadTime', 10.2, 10)` is `'flat'`; any `null` gives `null`.
  - `densityTone(1)` ok, `densityTone(1.01)` warn, `densityTone(2)` warn, `densityTone(2.01)` bad, `densityTone(null)` null.
  - `buildQualityDashboard` on a 4-week period with known deployments: asserts each metric's `value`, `previous`, `level`, `trend`; median of an even count; `dora` has the 4 keys in order; `weeks` has 4 rows with the right `weekStart` values.
  - Review Focus 1 to 4, one test each.
  - A module with `kloc: 0` has density and tone `null`.
- [ ] **Step 2: Run `npx vitest run --project unit tests/unit/entities/quality-metrics.test.ts`.** Expected: fails because the functions are not exported.
- [ ] **Step 3: Implement the four functions in `src/entities/quality-metrics.ts`.**
- [ ] **Step 4: Run the same command.** Expected: all pass.
- [ ] **Step 5: Write the failing use-case test:** a fake gateway returning fixed records; `createLoadQualityDashboard(fake)()` resolves to `buildQualityDashboard(records)`; a gateway that rejects makes the use case reject. Run it, see it fail, implement `src/use-cases/load-quality-dashboard.ts`, run again.
- [ ] **Step 6: Write `src/adaptor/sample/quality-metrics-gateway.ts`.** `periodStart: '2026-07-20'`, `periodEnd: '2026-10-11'`, `isSample: true`. Modules exactly: `booking` "จองที่นั่ง" risk `'R1'` kloc `1.2`; `payment` "ชำระเงิน" risk `'R2'` kloc `1.35`; `access` "สิทธิ์เข้าถึง" risk `null` kloc `0.95`; `admin` "จัดการคอร์ส" risk `null` kloc `1.25`. Write deployments and defects as literal arrays so that: every week has at least one deployment; the later half has more deployments, a shorter median lead time and a lower failure rate than the earlier half; both halves have at least one failed deployment with `restoreMinutes`; `payment` has the highest density (`bad`), `booking` is `warn`, `access` and `admin` are `ok`.
- [ ] **Step 7: Add a test in `tests/unit/entities/quality-metrics.test.ts`** that imports the sample gateway, builds the dashboard and asserts the story in Step 6 (all four trends `'better'`, the four tones, module KLOC sum `toBeCloseTo(4.75)`, 12 weekly rows, no weekly `deployments` of 0). Unit tests may import the adaptor here because it has no I/O.
- [ ] **Step 8: Wire `loadQualityDashboard` in `src/app/deps.ts`.**
- [ ] **Step 9: Run `npm run test:unit` and `npx tsc --noEmit`.** Expected: both pass, including `layering.test.ts`. Report the output.

---

### Task 2: UI (teammate "UI")

**Files:**
- Create: `src/components/ui/chart.tsx` via `npx shadcn@latest add chart` (adds `recharts`; do not hand-write it), `src/ui/pages/QualityPage.tsx` + `.styles.ts`, `src/ui/quality/labels.ts`, `src/ui/quality/dora-cards.tsx`, `src/ui/quality/dora-trend.tsx`, `src/ui/quality/defect-density.tsx`, `src/ui/quality/data-sources.tsx`, each `.tsx` with a sibling `.styles.ts`
- Modify: `src/App.tsx` (route), `src/components/app-shell.tsx` (nav item), `src/index.css` only if chart colors need tokens
- Test: `tests/e2e/quality-dashboard.spec.ts`

**Interfaces:**
- Consumes: Task 0 types from `@/entities/quality-metrics`; `loadQualityDashboard(): Promise<QualityDashboard>` from `@/app/deps` (Task 1 adds it while you work; do not create it yourself. If it is still missing when you finish, say so in your report).
- Produces: default export `QualityPage`; route `/quality`; admin nav item `{ to: '/quality', label: 'คุณภาพระบบ', icon: Gauge }`.

**Decisions:**
- Invoke the `dataviz` skill before writing any chart code or choosing chart colors, and follow it. The current `--chart-1..5` tokens in `src/index.css` are greys; replace them there if the skill calls for it. Colors reach charts as CSS variables through shadcn's `ChartConfig`, never as hex in TSX.
- The four DORA metrics have four different units: draw four small single-series line charts (small multiples), not one multi-axis chart. `null` weekly values leave a gap (`connectNulls` off).
- Defect density: one horizontal bar per module, plus a shadcn `Table` with columns โมดูล, ความเสี่ยง, KLOC, Defect, Defect Density, สถานะ, and a last row "รวมทั้งระบบ" from `overall`. Tone uses the existing `StatusBadge` (`@/components/status-badge`): ok "อยู่ในเกณฑ์", warn "เฝ้าระวัง", bad "เกินเกณฑ์". `risk: null` shows "-".
- Page states follow `src/pages/PaymentsPage.tsx`: `PageLoading` while loading, `PageError` with "โหลดข้อมูลคุณภาพระบบไม่สำเร็จ กรุณาลองใหม่" on failure, `PageHeader` title "คุณภาพระบบ", description "ตัวชี้วัด DORA และ Defect Density สำหรับรายงานผู้บริหาร".
- Sample notice: shadcn `Alert`, shown when `isSample`, title "ข้อมูลตัวอย่าง", text "ตัวเลขในหน้านี้เป็นข้อมูลตัวอย่างเพื่อสาธิตรูปแบบรายงาน ยังไม่ได้ดึงจากระบบจริง" plus the period as Thai dates.
- DORA card: metric name as the card title (English term), a one-line Thai meaning, the value with unit, a level badge, and direction text "ดีขึ้น" / "แย่ลง" / "คงที่" with "เทียบกับ 6 สัปดาห์ก่อนหน้า" (derive the week count from the period). `null` value shows "N/A" and no badge. Units: ครั้ง/สัปดาห์; ชั่วโมง under 48 h, otherwise วัน; %; นาที under 120 min, otherwise ชั่วโมง. Thai meanings: ความถี่ในการนำระบบขึ้นใช้งาน; เวลาตั้งแต่แก้โค้ดจนขึ้นใช้งาน; สัดส่วนการขึ้นระบบที่ทำให้เกิดปัญหา; เวลาที่ใช้กู้ระบบเมื่อเกิดปัญหา.
- Formatting and label lookups live in `src/ui/quality/labels.ts` as pure functions.
- Data sources table rows (แหล่งข้อมูลจริง, วิธีคำนวณ):
  - Deployment Frequency: GitHub Actions, run ที่ deploy ขึ้น production สำเร็จ; นับจำนวนครั้งต่อสัปดาห์
  - Lead Time for Changes: GitHub, เวลา commit แรกของ pull request ถึงเวลา deploy สำเร็จ; ค่ามัธยฐาน
  - Change Failure Rate: GitHub Issues ที่ติด label `incident` ผูกกับการ deploy; จำนวน deploy ที่เกิดปัญหา ÷ deploy ทั้งหมด
  - Time to Restore: GitHub Issues ที่ติด label `incident`, เวลาเปิดถึงเวลาปิด; ค่ามัธยฐาน
  - Defect Density: GitHub Issues ที่ติด label `bug` แยกตาม label โมดูล และขนาดโค้ด (ncloc) จาก SonarQube; จำนวน defect ÷ KLOC
- Section headings are `h2`: "DORA Metrics", "แนวโน้มรายสัปดาห์", "Defect Density รายโมดูล", "แหล่งข้อมูลเมื่อเชื่อมต่อระบบจริง". Layout works at phone width: cards wrap, tables scroll inside their card.
- Route in `App.tsx`: `{profile.role === 'admin' && <Route path="/quality" element={<QualityPage />} />}`.

- [ ] **Step 1: Write `tests/e2e/quality-dashboard.spec.ts`.** Test "quality dashboard opened by an admin shows DORA metrics and defect density": go to `/`, click `getByRole('button', { name: 'แอดมิน', exact: true })` (demo sign-in), click the nav link "คุณภาพระบบ", expect heading level 1 "คุณภาพระบบ", the text "ข้อมูลตัวอย่าง", the four metric names, and a table row containing "ชำระเงิน". A second test "quality dashboard is not offered to a parent": sign in with the "ผู้ปกครอง 1" demo button, expect no link "คุณภาพระบบ", go to `/quality`, expect the heading "คุณภาพระบบ" to be absent.
- [ ] **Step 2: `npx shadcn@latest add chart`**, then load the `dataviz` skill.
- [ ] **Step 3: Build `labels.ts` and the four feature components** as presentational components taking slices of `QualityDashboard` as props.
- [ ] **Step 4: Build `QualityPage`, add the route and the nav item.**
- [ ] **Step 5: Review Focus 5:** confirm the error path renders `PageError` and that a `null` weekly value draws a gap.
- [ ] **Step 6: Run `npm run test:unit` and `npx tsc --noEmit`.** Expected: pass, including `styles.test.ts`.
- [ ] **Step 7: Run the E2E** once `loadQualityDashboard` exists: copy `playwright.config.ts` to `playwright.tmp-quality.config.ts` with port 5174 in `baseURL`, `command` and `url`, run `npx playwright test --config playwright.tmp-quality.config.ts quality-dashboard`, then delete the temp config. Report the output. If the local Supabase stack is not running, say so instead of starting it.

---

### Task 3: Docs (teammate "Docs")

**Files:**
- Modify: `TEST_PLAN.txt`, section 9 only (and the document version/date lines if you bump them)

- [ ] **Step 1: Read the spec and `TEST_PLAN.txt` section 9.**
- [ ] **Step 2: Rewrite section 9** in the file's existing style (plain text, Thai, hard-wrapped near 80 columns, numbered lists, no Markdown) so that it:
  - says the dashboard is the admin page "คุณภาพระบบ" at `/quality` in the app, showing sample data, and why sample data (real history is too thin; real anchor is 4.75 KLOC from SonarQube);
  - replaces the sentence that says the dashboard is not a page in the SeatSure app;
  - defines the four DORA metrics with the level table from the spec, and Defect Density with its formula and the ok/warn/bad targets, stating the targets are the project's own;
  - lists the real data source for each metric (same content as the Task 2 data sources rows);
  - keeps the existing CI-level metrics (test health, workflow coverage, performance, security, release signal) as the next step, shortened where they repeat;
  - ends with an accurate status: CI pipeline exists (section 9 already says so after the last change), the dashboard page shows sample data, real collection is not built.
- [ ] **Step 3: Re-read the whole section** for contradictions with sections 2 and 8, and fix lines there only if they now state something false. Report what you changed.

---

### Task 4: Integrate (lead)

- [ ] `npm run test:unit`, `npx tsc --noEmit`, `npm run build`.
- [ ] Run the E2E on port 5174 and look at the page in a browser at desktop and phone width.
- [ ] Commit per task, push `feat/quality-dashboard`, hand the pull request link to the project owner.
