# AI Sana — practical tasks platform

[![Русский](https://img.shields.io/badge/README-на_русском-1f6feb)](docs/README.ru.md)
[![Live demo](https://img.shields.io/badge/demo-sana--alpha--one.vercel.app-ff6b4a?logo=vercel&logoColor=white)](https://sana-alpha-one.vercel.app)
![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A524-5fa04e?logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-12-f69220?logo=pnpm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)
![Hono](https://img.shields.io/badge/Hono-4-e36002?logo=hono&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%7C%20Auth-3ecf8e?logo=supabase&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/API-Cloudflare%20Workers-f38020?logo=cloudflareworkers&logoColor=white)

AI Sana brings students, mentors, teachers and businesses together around practical tasks. A team runs its project through stages and earns points only for progress a mentor has confirmed; a business turns a problem description into a task card with the help of a model; matching explains which task suits which team; in Practice Lab a model checks a student's work against criteria before a teacher decides; in Research Arena a team argues its way to a conclusion that a teacher reviews.

The repository is a pnpm monorepo: an API-first modular monolith in TypeScript and a web client (the interface is in Russian).

**Deployment:** [local](docs/local-deploy.md) · [server (Vercel + Cloudflare Workers + Supabase)](docs/server-deploy.md)

| Module | What it does |
| --- | --- |
| Core | profiles and roles (student, mentor, teacher, business), teams and skills, task catalog, evidence, points ledger, leaderboards |
| Startup Sprint | team project, 5 stages from idea to testing, tasks with technologies, points for confirmed progress, achievements, next step |
| Business Challenge Builder | dialog with a business: completeness check, follow-up questions, readiness, task card, manual publishing, before/after comparison |
| Challenge Match | task recommendations for a team with explanations, applications, business decision → project in the tracker, business feedback and a real-task multiplier |
| Practice Lab | modules with a test, assignments with criteria, model check with quoted errors, up to 5 attempts, points for self-correction after the teacher accepts, teacher dashboard with problem topics |
| Research Arena | research questions, team discussion with roles, a conclusion with arguments and sources, teacher review |

## Packages

- `apps/api` (`@sana/api`) — HTTP API on Hono with OpenAPI 3.1: docs at `/docs`, all routes under `/api`. Stores data in Postgres (Drizzle ORM), verifies Supabase Auth JWTs, keeps evidence files in Supabase Storage, calls the model through the AI SDK and Gemini. Runs as a Node server locally and as a Cloudflare Worker in production.
- `apps/web` (`@sana/web`) — SPA on Vite, React 19, TanStack Router and Query, Tailwind CSS 4 and shadcn/ui, structured by Feature-Sliced Design.
- `packages/contracts` (`@sana/contracts`) — Zod request and response schemas and the exported `openapi.json`. Shipped as TypeScript source, no build step.

The API validates requests with `@sana/contracts` and exports `openapi.json` from them; the web client generates its `openapi-fetch` types from that file and reuses the same schemas in forms. In the browser, Supabase is used only to sign in and to upload files through signed URLs; all data goes through the API.

## Web client

The home screen depends on the role.

- **Student** — team (members, roles, skills), sprint projects; project page: stage map, next step, tasks, evidence with file uploads, points feed, leaderboard; business tasks with recommendations and applying; applications.
- **Mentor** — review queue (approve / approve with adjustment / send back), projects: stage dates and point adjustments.
- **Teacher** — practice modules: assignments, student results, problem topics; review of practice work and research conclusions.
- **Business** — task builder: dialog with a live card, composing and editing the card, publishing, before/after; my tasks: applications, decisions, team progress, feedback on results.

Sign-in uses Supabase Auth email and password. Sign-up goes through the API (`POST /auth/sign-up`), which creates an already confirmed account, so no confirmation email is sent. After sign-up the user picks a role: student or business; mentor and teacher roles cannot be self-assigned.

## Quick start

Requires Node.js 24+, pnpm 12.17.0 and Podman (or Docker) for the local Supabase. Full walkthrough: [docs/local-deploy.md](docs/local-deploy.md).

```bash
pnpm install
```

```bash
pnpm db:start
```

```bash
cp .env.example .env
```

Fill `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` from `pnpm db:status`, then:

```bash
pnpm db:migrate
```

```bash
pnpm seed
```

```bash
pnpm dev
```

```bash
pnpm dev:web
```

API: http://localhost:8787 (docs at `/docs`). Web: http://localhost:5173. Demo accounts: `alice@sana.local` (student), `mentor@sana.local`, `teacher@sana.local`, `daily@sana.local` (business); the password is in `data/demo-accounts.json` after seeding (set `SEED_PASSWORD` to keep it between runs).

## Configuration

The API and the web client read one `.env` in the repository root: the API through `--env-file-if-exists` in the `@sana/api` scripts, Vite through `envDir`, and only `VITE_*` variables reach the browser. `.env.example` holds values for the local Supabase. The Cloudflare Worker gets the same settings as bindings; see [server deployment](docs/server-deploy.md).

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | Postgres connection string; locally `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| `SUPABASE_URL` | yes | — | Supabase URL; locally `http://127.0.0.1:54321` |
| `SUPABASE_PUBLISHABLE_KEY` | yes | — | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | yes | — | Supabase secret key for the API and seeding; never expose it to the web client |
| `AI_PROVIDER` | no | `mock` | `google` calls Gemini; `mock` disables the model |
| `GOOGLE_API_KEY` | with `google` | — | Gemini API key |
| `AI_MODEL_FAST` | with `google` | — | model for quick calls: builder dialog turns, task requirements, next-step text |
| `AI_MODEL_STRONG` | no | `AI_MODEL_FAST` | model for composing the task card |
| `AI_THINKING_FAST`, `AI_THINKING_STRONG` | no | unset | thinking level `minimal`, `low`, `medium` or `high`, for models that support it |
| `PORT` | no | `8787` | API port (Node server) |
| `EVIDENCE_BUCKET` | no | `evidence` | Storage bucket for evidence files |
| `CORS_ORIGINS` | no | `http://localhost:5173,http://localhost:3000` | comma-separated web origins allowed to call the API |
| `VITE_API_URL` | yes, for web | — | API URL, e.g. `http://localhost:8787` |
| `VITE_SUPABASE_URL` | yes, for web | — | Supabase URL; `.env.example` uses `$SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes, for web | — | Supabase publishable key; `.env.example` uses `$SUPABASE_PUBLISHABLE_KEY` |

The API validates the variables on start and exits with a list of errors if required ones are missing.

## Checks

```bash
pnpm typecheck
```

```bash
pnpm lint
```

```bash
pnpm test
```

```bash
pnpm build
```

- `pnpm lint` — ESLint, including API module boundaries (modules don't import each other) and React hooks rules.
- `pnpm test` — rule unit tests, API HTTP integration tests and web unit tests. The HTTP tests recreate a separate `sana_test` database in the local Postgres, so `pnpm db:start` must be running.
- `pnpm --filter @sana/web lint:fsd` — Steiger: Feature-Sliced Design layers and public APIs.

## Changing the API

After changing routes or schemas, export OpenAPI and regenerate the client types:

```bash
pnpm --filter @sana/api openapi
```

```bash
pnpm --filter @sana/web gen:api
```

Migrations: after changing the Drizzle schema run `pnpm db:generate`, then `pnpm db:migrate`. Migrations enable RLS and revoke Data API grants: data is reachable only through the API.

Model scripts (need `AI_PROVIDER=google` and a key):

- `pnpm --filter @sana/api ai:smoke [models…]` — Gemini access and a structured response.
- `pnpm --filter @sana/api eval:bcb` — runs the builder on the 15 descriptions in `data/bcb-descriptions.json`: strong descriptions must score higher readiness than weak ones.
- `pnpm --filter @sana/api demo:match [Team]` — recommendations and a growth plan for a seeded team (no model needed).

## Code layout

```
packages/contracts/   Zod API schemas (shared with web) and openapi.json
apps/api/src/
  platform/           env, database, auth (JWT verification), RFC 9457 errors, events, AI provider, storage
  core/               identity, catalog, evidence, points — shared core
  modules/            sprint, challenge-builder, match, practice, research — never import each other
  flows/              cross-module scenarios (accepted application → task → Sprint project)
  index.ts, worker.ts Node server and Cloudflare Worker entry points
apps/api/drizzle/     SQL migrations
apps/web/src/         app → pages → widgets → features → entities → shared (FSD)
data/                 synthetic seed data: skills, roles, templates, tasks, teams, descriptions, practice modules, research tasks and discussions
docs/                 deployment guides and the Russian README
SKILLS/               agent skills for this repository (production deploy)
```

API errors use `application/problem+json` (RFC 9457); the web client shows field errors inline in forms.

## Domain rules

- Code computes points, not the model. The model classifies and phrases; awards are pure functions, the ledger is append-only, and an idempotency key prevents double awards.
- Points only for actions a mentor has confirmed. Speed adds a bonus only to the points of a confirmed stage.
- The builder never invents facts about the company: the model's quote must be found in the business's own messages, otherwise the field is "not specified". Personal data (email, phone, IIN with a valid check digit, card numbers passing Luhn) blocks publishing.
- Matching uses only the team's skills, time and interests; a recommendation is not an assignment, and both sides confirm the collaboration.

Point scales and field weights are initial values set in code: `apps/api/src/modules/sprint/points.config.ts`, `apps/api/src/modules/challenge-builder/readiness.ts`, `apps/api/src/modules/match/scoring.ts`.
