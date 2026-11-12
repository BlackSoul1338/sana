# Local deployment

Runs the whole stack on one machine: Supabase (Postgres, Auth, Storage) in containers, the API and the web client as Node processes.

## Prerequisites

- Node.js 24 or newer.
- pnpm 12.17.0, pinned in `packageManager` (`corepack enable` picks it up).
- Podman with the user socket. The `db:*` scripts run the Supabase CLI (a dev dependency) with `DOCKER_HOST=unix://$XDG_RUNTIME_DIR/podman/podman.sock`. With Docker, call `pnpm exec supabase start` / `stop` / `status` directly instead.
- Optional: a Gemini API key. Without it the API still starts, the challenge builder answers `ai_unavailable`, and the next-step hint falls back to a template.

## Setup

```bash
pnpm install
```

```bash
systemctl --user enable --now podman.socket
```

```bash
pnpm db:start
```

Create `.env` from the example and fill in `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` with `PUBLISHABLE_KEY` and `SECRET_KEY` from `pnpm db:status`. All variables are described in the [configuration table](../README.md#configuration).

```bash
cp .env.example .env
```

Apply migrations and load the synthetic data. `pnpm seed` **deletes all data** and only runs against `127.0.0.1` or `localhost` unless you pass `--force`.

```bash
pnpm db:migrate
```

```bash
pnpm seed
```

## Run

API and web in separate terminals:

```bash
pnpm dev
```

```bash
pnpm dev:web
```

- API: http://localhost:8787, interactive docs at http://localhost:8787/docs.
- Web: http://localhost:5173.
- Demo accounts after seeding: `alice@sana.local` (student), `mentor@sana.local` (mentor), `teacher@sana.local` (teacher), `daily@sana.local` (business). The password is written to `data/demo-accounts.json` (gitignored); it changes on every run unless `SEED_PASSWORD` is set.

## Run the API as a Cloudflare Worker locally

To reproduce production behavior (Workers runtime, one database connection per request), run the Worker build instead of `pnpm dev`. Both listen on port 8787, so run only one of them.

1. Put the local Supabase values into `apps/api/.dev.vars` (gitignored, `.env` format): `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GOOGLE_API_KEY`.
2. Start it:

   ```bash
   pnpm --filter @sana/api dev:worker
   ```

The local Hyperdrive binding connects straight to the local Postgres (`127.0.0.1:54322`), as configured in `apps/api/cloudflare.config.ts`.

## Tests

`pnpm test` recreates a separate `sana_test` database in the local Postgres, so Supabase must be running. Point it elsewhere with `TEST_DATABASE_URL`; run only the database-free tests with `pnpm --filter @sana/api test:unit`.

## Stop

Stop the dev processes with Ctrl+C, then:

```bash
pnpm db:stop
```

There is no Docker Compose: only Supabase runs in containers.
