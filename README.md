<!-- Improved compatibility of back to top link -->
<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]



<!-- PROJECT LOGO -->
<br />
<div align="center">
  <h3 align="center">SeatSure</h3>

  <p align="center">
    A small after-school course booking system built around one promise:
    <br />
    <strong>"Paid means seated: never over capacity, never double-booked, never lost."</strong>
    <br />
    <br />
    <a href="docs/fern/pages/overview.mdx"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="#getting-started">Run it locally</a>
    &middot;
    <a href="https://github.com/tktanawat138-alt/SeatSure/issues/new">Report Bug</a>
    &middot;
    <a href="https://github.com/tktanawat138-alt/SeatSure/issues/new">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
        <li><a href="#project-structure">Project Structure</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#testing">Testing</a></li>
    <li><a href="#documentation">Documentation</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

[![SeatSure sign-in page][product-screenshot]](docs/images/screenshot-login-dark.png)

Parents book a seat in a course, pay by bank transfer by attaching a proof of transfer, and confirm
the payment to get a receipt. Teachers propose courses, the school admin approves them. The payment
is a simulation: no real money moves.

The system exists to keep three guarantees true under load:

| Promise | Risk | What protects it |
|---|---|---|
| Never over capacity | R1: more bookings than seats | `book_seat` locks the course row before it counts seats |
| Never double-booked or double-charged | R2: duplicate booking or charge | unique index per active booking, and `confirm_transfer_payment` is idempotent |
| Never lost | R2: paid but no seat | the payment and the seat are confirmed in the same transaction; a paid booking on a cancelled course creates a refund report |

All business rules live in the backend API (Clean Architecture, testable layer by layer). The
frontend only talks to that API through an authentication middleware.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



### Built With

* [![React][React.js]][React-url]
* [![Vite][Vite.js]][Vite-url]
* [![TypeScript][TypeScript.org]][TypeScript-url]
* [![Tailwind CSS][Tailwind.css]][Tailwind-url]
* [![shadcn/ui][Shadcn.ui]][Shadcn-url]
* [![Express][Express.js]][Express-url]
* [![Supabase][Supabase.com]][Supabase-url]
* [![Vitest][Vitest.dev]][Vitest-url]
* [![Playwright][Playwright.dev]][Playwright-url]
* [![k6][K6.io]][K6-url]
* [![Fern][Fern.com]][Fern-url]

Also: [CVA](https://cva.style/) for every component style, [zod](https://zod.dev/) for the API contract,
[Task](https://taskfile.dev/) as the command runner.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



### Project Structure

```text
SeatSure/
├── apps/
│   ├── backend/            Express API (Clean Architecture) + local Supabase project
│   │   ├── src/            entities, interfaces, use-cases, adaptor/{http,supabase}
│   │   ├── supabase/       migrations, RLS policies, SQL functions, config
│   │   ├── scripts/        env writer, seed, OpenAPI generator
│   │   └── tests/          unit + integration
│   └── frontend/           React app: entities, interfaces, use-cases, adaptor/http, pages
│       └── tests/          unit + integration
├── tests/                  cross-app integration, Playwright e2e, k6 load tests
├── docs/                   Fern docs (guides + API reference) and living notes
├── Taskfile.yml            task up / down / test / docs
└── AGENTS.md               rules for people and agents working on the repo
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- GETTING STARTED -->
## Getting Started

Everything runs locally with one command. The local database holds only synthetic data.

### Prerequisites

* Node.js 20.12 or newer
* [Docker Desktop](https://www.docker.com/products/docker-desktop/), running
* [Task](https://taskfile.dev/installation/)
  ```sh
  brew install go-task
  ```
* [Supabase CLI](https://supabase.com/docs/guides/cli)
  ```sh
  brew install supabase/tap/supabase
  ```
* [k6](https://github.com/grafana/k6), only for load tests
  ```sh
  brew install k6
  ```

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/tktanawat138-alt/SeatSure.git
   cd SeatSure
   ```
2. Start everything: local Supabase, sample data, the API and the web app
   ```sh
   task up
   ```
   The first run takes a few minutes while Docker pulls the Supabase images.
3. Open [http://localhost:5173](http://localhost:5173)
4. Stop everything
   ```sh
   task down
   ```

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:3001 (`/health`) |
| Supabase (local) | http://localhost:54321 |
| Docs preview (`task docs:dev`) | http://localhost:3000 |

`task up` works without the Supabase CLI too: it prints a warning, skips the backend and starts the web app only.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- USAGE EXAMPLES -->
## Usage

Sign in with a sample account. The password is `seatsure123` for every account (local only).

| Role | Email | What it can do |
|---|---|---|
| Parent | `parent1@seatsure.test` ... `parent10@seatsure.test` | browse courses, book a seat, attach a transfer proof, confirm payment, open the receipt |
| Teacher | `teacher1@seatsure.test`, `teacher2@seatsure.test` | propose a course (pending), change the schedule of their own courses, see the bookings of their courses |
| School admin | `admin01@seatsure.test` | everything the admin does, plus approve or reject proposed courses and open proof images |
| Admin | `admin@seatsure.test` | change capacity, open or close registration, cancel a course (creates refund reports), review payments |

Typical flow: a teacher proposes a course, `admin01` approves it, a parent books a seat, attaches a proof
image (JPEG, PNG or WebP, up to 5 MiB) and confirms the payment. Cancelling a course with paid bookings
adds a refund report; no money is moved automatically.

The sign-in page has buttons for the sample accounts when it runs on localhost.

_For more detail, see the [docs](docs/fern/pages/overview.mdx)._

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- TESTING -->
## Testing

Tests are split by level and by where they live. Every change is written test first.

| Where | Level | Command |
|---|---|---|
| `apps/frontend/tests/unit/` | unit: use cases, layering rules, styling rules, theme | `task test:unit` |
| `apps/backend/tests/unit/` | unit: business rules with fake ports, API contract with fake deps | `task test:unit` |
| `apps/frontend/tests/integration/` | frontend gateways and middleware over a stubbed network | `task test:integration:frontend` |
| `apps/backend/tests/integration/` | API over HTTP against real local Supabase: RLS, RPC, concurrency | `task test:integration:backend` |
| `tests/integration/` | frontend gateways against the running API | `task test:integration:cross` |
| `tests/e2e/` | Playwright through the browser | `task test:e2e` |
| `tests/load/` | k6 smoke, auth and booking-contention scenarios | `task test:load` |

```sh
task test               # unit + integration + e2e
task test:ui:frontend   # Vitest UI (also :backend and :cross)
```

The concurrency guarantees can be seen failing on purpose: the integration tests can run against a naive
"check then save" booking implementation.

```sh
cd apps/backend && npm run test:unsafe
```

Load tests only run against localhost unless `ALLOW_REMOTE=1` is set. See the
[testing guide](docs/fern/pages/testing.mdx).

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- DOCUMENTATION -->
## Documentation

The docs are the single source of truth, built with [Fern](https://github.com/fern-api/fern):

* Guides: `docs/fern/pages/` (overview, architecture, authentication, API conventions, frontend, backend, testing, running locally)
* API reference: generated from the endpoint registry and the zod contract into `docs/fern/openapi/openapi.json`
* Living notes: `docs/notes/` (one dated note per change, what and why)
* Design and plans: `docs/superpowers/`

```sh
task docs:dev       # preview the docs at http://localhost:3000
task docs:openapi   # regenerate the OpenAPI spec after any API change
task docs:check     # validate the Fern project
```

A stale OpenAPI spec fails `apps/backend/tests/unit/openapi.test.ts`. Read the docs before you start a task
and write or update them when you finish; see [AGENTS.md](AGENTS.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- ROADMAP -->
## Roadmap

- [x] Backend API with Clean Architecture; frontend goes through an auth middleware
- [x] Bank-transfer payment with proof upload and idempotent confirmation
- [x] Dark theme and smooth, reduced-motion-aware components (CVA)
- [x] Fern docs generated from the API registry
- [x] Unit, integration, e2e and k6 load tests
- [ ] Host the API (today it runs locally; the web app deploys to Cloudflare as a static site)
- [ ] Publish the Fern docs site
- [ ] Check proof images by content, not only by declared type
- [ ] httpOnly cookie sessions instead of `localStorage`
- [ ] Realtime updates instead of 15-second polling

See the [open issues](https://github.com/tktanawat138-alt/SeatSure/issues) for a full list of proposed features and known issues.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- CONTRIBUTING -->
## Contributing

1. Create a feature branch from `main` (`git checkout -b feat/short-name`)
2. Read `docs/` and [AGENTS.md](AGENTS.md) first: layers, shadcn-only UI, CVA styling, test levels
3. Write the failing test first, then the code
4. Update the docs or add a dated note in `docs/notes/`; run `task docs:openapi` if the API changed
5. Run `task test` and `task docs:check`
6. Commit, push the branch and open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- LICENSE -->
## License

No license has been chosen yet. Until one is added, all rights are reserved by the authors.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- CONTACT -->
## Contact

Project Link: [https://github.com/tktanawat138-alt/SeatSure](https://github.com/tktanawat138-alt/SeatSure)

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
* [shadcn/ui](https://ui.shadcn.com) and [CVA](https://cva.style/)
* [Supabase](https://supabase.com)
* [Fern](https://github.com/fern-api/fern)
* [Grafana k6](https://github.com/grafana/k6)
* [Vitest](https://vitest.dev) and [Playwright](https://playwright.dev)
* [Superpowers](https://github.com/obra/superpowers) workflow skills

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- MARKDOWN LINKS & IMAGES -->
[forks-shield]: https://img.shields.io/github/forks/tktanawat138-alt/SeatSure.svg?style=for-the-badge
[forks-url]: https://github.com/tktanawat138-alt/SeatSure/network/members
[stars-shield]: https://img.shields.io/github/stars/tktanawat138-alt/SeatSure.svg?style=for-the-badge
[stars-url]: https://github.com/tktanawat138-alt/SeatSure/stargazers
[issues-shield]: https://img.shields.io/github/issues/tktanawat138-alt/SeatSure.svg?style=for-the-badge
[issues-url]: https://github.com/tktanawat138-alt/SeatSure/issues
[product-screenshot]: docs/images/screenshot-login.png
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Vite.js]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vite.dev/
[TypeScript.org]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[Tailwind.css]: https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[Shadcn.ui]: https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white
[Shadcn-url]: https://ui.shadcn.com/
[Express.js]: https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white
[Express-url]: https://expressjs.com/
[Supabase.com]: https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white
[Supabase-url]: https://supabase.com/
[Vitest.dev]: https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white
[Vitest-url]: https://vitest.dev/
[Playwright.dev]: https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white
[Playwright-url]: https://playwright.dev/
[K6.io]: https://img.shields.io/badge/k6-7D64FF?style=for-the-badge&logo=k6&logoColor=white
[K6-url]: https://k6.io/
[Fern.com]: https://img.shields.io/badge/Fern-4E9F3D?style=for-the-badge
[Fern-url]: https://buildwithfern.com/
