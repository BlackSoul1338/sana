---
name: prod-deploy
description: Deploys AI Sana to production — the API Worker on Cloudflare, database migrations on Supabase, and the web app on Vercel. Use when the user asks to deploy, release, ship or update production, after merging API or migration changes into main, or when production shows behavior that main already fixed.
---

# Production deploy

## What updates itself and what does not

| Part | Where | After a merge into `main` |
| --- | --- | --- |
| Web (`apps/web`) | Vercel project `sana`, https://sana-alpha-one.vercel.app | Builds and deploys automatically |
| API (`apps/api`) | Cloudflare Worker `sana-api`, https://sana-api.blacksoul1338.workers.dev | **Manual deploy** |
| Database schema (`apps/api/drizzle`) | Supabase project `nxxwdkkniparbquhdcsf` | **Manual migration** |
| Web env vars (`VITE_*`) | Vercel project settings | Baked in at build: **manual redeploy** after changing them |

The Cloudflare Worker named `sana` (Git-connected builds) is not used and its builds fail; ignore it.

## Rules

- Production deploys and migrations need an explicit go-ahead from the user in this conversation.
- Deploy from an up-to-date `main` (or the PR branch the user named), after `pnpm typecheck && pnpm lint && pnpm test` pass.
- Never print secrets. The repo-root `.env` holds the production values; read it only through the script below.
- Never run `pnpm seed` against production: it deletes all data.

## API deploy

Needed when anything under `apps/api/src`, `packages/contracts` or `apps/api/cloudflare.config.ts` changed since the last deploy.

```bash
python3 SKILLS/prod-deploy/scripts/deploy_api.py --dry-run
python3 SKILLS/prod-deploy/scripts/deploy_api.py
```

The script writes `apps/api/.dev.vars.production` (gitignored), sets `HYPERDRIVE_ID`, `CORS_ORIGINS` and the `AI_*` settings, runs `pnpm deploy:worker` and masks secrets in the output. It refuses to run if `SUPABASE_URL` in `.env` is not the cloud project. To change CORS origins or the Hyperdrive id, edit the constants at the top of the script.

Verify:

```bash
curl -s https://sana-api.blacksoul1338.workers.dev/health
curl -s -i -X OPTIONS https://sana-api.blacksoul1338.workers.dev/api/me -H "Origin: https://sana-alpha-one.vercel.app" -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin
```

Expect `{"ok":true,"ai":"google"}` and the Vercel origin echoed back. Then ask the user to open the affected page while signed in; Claude must not type their passwords.

Rollback: `cf workers deployments --help` lists the commands for switching traffic to an earlier version.

## Database migrations

Needed when the merge added files under `apps/api/drizzle/`. Run before the API deploy, because the new API code expects the new schema. The root `.env` `DATABASE_URL` points at the cloud database:

```bash
pnpm db:migrate
```

## Learning catalog

After migrations that add catalog data, or when `data/practice-*.json` or `data/research-tasks.json` gained items. Needs at least one teacher account; adds only titles that are not in the database and deletes nothing:

```bash
pnpm seed:content
```

## Web redeploy without a code change

Only after changing `VITE_*` variables in Vercel (for example a new API URL):

```bash
vercel ls sana
vercel redeploy <latest production deployment URL> --target production
```

## Bindings reference

- Hyperdrive `sana-db` → Supabase session pooler (`aws-0-eu-central-1.pooler.supabase.com:5432`), query cache disabled (cached reads return stale data after writes).
- Worker secrets: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GOOGLE_API_KEY`.
- Vercel env (production and preview): `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Logins: `cf auth whoami`, `vercel whoami`. If either fails, ask the user to run `cf auth login` or `vercel login`.
