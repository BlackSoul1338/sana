# Server deployment

Production runs on three managed services:

| Part | Service | Updates after a merge into `main` |
| --- | --- | --- |
| Web client (`apps/web`) | Vercel, static build | Automatically (Git integration) |
| API (`apps/api`) | Cloudflare Workers, entry `apps/api/src/worker.ts` | **Manual deploy** |
| Database, Auth, Storage | Supabase cloud project | Schema: **manual migration** |

The API reaches Postgres through Cloudflare Hyperdrive, which pools connections to the Supabase pooler. The browser talks to Supabase only to sign in and to upload files through signed URLs.

## Contents

- [1. Supabase](#1-supabase)
- [2. API on Cloudflare Workers](#2-api-on-cloudflare-workers)
- [3. Web on Vercel](#3-web-on-vercel)
- [Updating production](#updating-production)
- [Free-plan limits](#free-plan-limits)

## 1. Supabase

1. Create a project. Take the values from the dashboard:
   - **Connect** → connection strings for `DATABASE_URL` and for Hyperdrive.
   - **Project Settings → API keys** → publishable and secret keys.
2. Put the cloud values into the repo-root `.env` (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) and apply migrations:

   ```bash
   pnpm db:migrate
   ```

3. Create the private `evidence` Storage bucket. Starting the Node API once against the cloud `.env` creates it (`pnpm dev`, then stop it). `pnpm seed --force` also creates it, but **deletes all data** first; use it only on an empty project to load demo data.
4. **Authentication → URL Configuration**: set **Site URL** to the web address. For sign-up without email confirmation, turn off **Confirm email** under **Authentication → Sign In / Providers → Email**, or configure SMTP.

## 2. API on Cloudflare Workers

Tools: the `cf` CLI (`pnpm add --global cf`; also a dev dependency of `@sana/api`). The Worker configuration is `apps/api/cloudflare.config.ts` (`cf` open-beta format).

1. Sign in and, once per account, register a `workers.dev` subdomain in the dashboard (**Workers & Pages → Onboarding**):

   ```bash
   cf auth login
   ```

2. Create a Hyperdrive config for the Supabase database. The `--origin-*` flags describe the database Hyperdrive connects to, taken from **Supabase → Connect → Session pooler**:

   | Flag | Value |
   | --- | --- |
   | `--origin-host` | pooler host, e.g. `aws-0-eu-central-1.pooler.supabase.com` |
   | `--origin-port` | `5432` — the session-mode pooler port (`6543` is transaction mode) |
   | `--origin-user` | `postgres.<project-ref>` |
   | `--origin-password` | the database password set when the project was created (not an API key) |
   | `--origin-database` | `postgres` |

   ```bash
   cf hyperdrive create --name sana-db --origin-scheme postgresql --origin-host <host> --origin-port 5432 --origin-database postgres --origin-user <user> --origin-password <password>
   ```

   Turn off its query cache; otherwise reads can return stale data for up to a minute after a write:

   ```bash
   cf hyperdrive update <hyperdrive-id> --caching-disabled
   ```

3. Put the secrets into `apps/api/.dev.vars.production` (gitignored): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GOOGLE_API_KEY`.
4. Deploy from `apps/api`. Plain settings (`AI_*`, `EVIDENCE_BUCKET`, `CORS_ORIGINS`) come from the shell; unset ones use the defaults from the [configuration table](../README.md#configuration). `CORS_ORIGINS` must list the web address.

   ```bash
   HYPERDRIVE_ID=<hyperdrive-id> AI_PROVIDER=google AI_MODEL_FAST=<model> CORS_ORIGINS=https://<web-domain> pnpm deploy:worker --secrets-file .dev.vars.production
   ```

5. Check it:

   ```bash
   curl https://sana-api.<subdomain>.workers.dev/health
   ```

## 3. Web on Vercel

1. Import the repository in Vercel. Set **Root Directory** to `apps/web`; the Vite preset builds into `dist`. `apps/web/vercel.json` rewrites every path to `index.html`, so direct links work.
2. Add environment variables for Production and Preview:
   - `VITE_API_URL` — the Worker URL.
   - `VITE_SUPABASE_URL` — `https://<project-ref>.supabase.co`.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — the publishable key. Never add the secret key.
3. Deploy. Vite inlines `VITE_*` at build time, so after changing them redeploy:

   ```bash
   vercel redeploy <production-deployment-url> --target production
   ```

## Updating production

- **Web:** merging into `main` triggers a Vercel production build.
- **API:** redeploy the Worker (step 2.4) after changes in `apps/api/src`, `packages/contracts` or `apps/api/cloudflare.config.ts`.
- **Schema:** when a merge adds files under `apps/api/drizzle/`, run `pnpm db:migrate` against the cloud database **before** deploying the API.
- `SKILLS/prod-deploy` holds the deploy procedure for this project's production as an agent skill, with a script that deploys the Worker from the root `.env` without printing secrets.

## Free-plan limits

- Workers: 100,000 requests per day; 10 ms of CPU time per request (time spent waiting for the database or the model does not count).
- Hyperdrive: 100,000 database queries per day, up to 20 connections to the origin.
- Keep list endpoints to a fixed number of queries: per-row queries exhaust the per-request connection quickly on Workers.
