# 2026-10-10 Pipeline demo walkthrough

## What

A short script for showing the CI pipeline live. This note is itself the change in the demo pull request: it touches
no code, so every check is expected to pass, and opening the pull request is what starts the pipeline.

## Steps to show

1. **Open the pull request.** `ci.yml` runs on every pull request and on every push to `main`. Five checks appear at
   the bottom of the Conversation tab:

   | Check | What it proves |
   |---|---|
   | Unit tests and build | Frontend and backend unit tests pass, the frontend builds, the backend type-checks, and the OpenAPI file matches the code |
   | Integration and E2E tests | On a fresh local Supabase built from the migrations: frontend, backend and cross-app integration tests, then the Playwright specs in a real browser |
   | Docs (Fern check) | The Fern docs are valid |
   | SonarQube scan | The scan was uploaded to SonarQube Cloud |
   | SonarCloud Code Analysis | The quality gate verdict for the new code in this pull request |

2. **Open the run** (Details next to any check, or the Actions tab). Each job lists its steps; the Integration and E2E
   job shows the database being built and each test level in turn. The Playwright report is under Artifacts on the
   run summary and is kept for 14 days.
3. **Open SonarQube Cloud**: `https://sonarcloud.io/project/overview?id=tktanawat138-alt_SeatSure`. The pull request is
   listed under Pull Requests with its own gate result.
4. **Merge.** The same pipeline runs again on `main`, and the project's main branch status on SonarQube Cloud updates
   when that run finishes.
5. **Quality dashboard** (optional): `task up`, sign in with the admin demo account, open "คุณภาพระบบ" from the menu.
   The figures are sample data; see `docs/notes/2026-10-10-quality-dashboard.md`.

## Caveats

- There is no deploy job. Merging does not change the site on Cloudflare; that is still the manual `npm run deploy`
  described in `docs/fern/pages/ci-cd.mdx`.
- The quality gate does not check coverage: no coverage report is uploaded, so every file is excluded from that
  metric (`sonar.coverage.exclusions` in `sonar-project.properties`).
- To show the pipeline stopping a defect, use a separate pull request that breaks a rule on purpose (for example a
  DORA level boundary in `apps/frontend/src/entities/quality-metrics.ts`); the Unit tests and build check goes red.
  Do not merge that one.
