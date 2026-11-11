#!/usr/bin/env python3
"""Deploy the API Worker (sana-api) to Cloudflare from the repo-root .env.

Usage (from the repo root):
    python3 SKILLS/prod-deploy/scripts/deploy_api.py            # deploy
    python3 SKILLS/prod-deploy/scripts/deploy_api.py --dry-run  # build and show bindings only

Secrets never reach stdout: they go to apps/api/.dev.vars.production (gitignored, mode 600)
and are masked in the deploy output.
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
API_DIR = ROOT / "apps" / "api"
SECRETS_FILE = API_DIR / ".dev.vars.production"

# Hyperdrive config "sana-db" (Supabase session pooler, port 5432, query cache disabled).
HYPERDRIVE_ID = "5bdb0b93106f4febad922802c621f580"
# Public Vercel domain first; the team domain sits behind Vercel login.
CORS_ORIGINS = "https://sana-alpha-one.vercel.app,https://sana-black-soul1338.vercel.app"

SECRET_KEYS = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "GOOGLE_API_KEY"]
PLAIN_KEYS = ["AI_PROVIDER", "AI_MODEL_FAST", "AI_MODEL_STRONG", "AI_THINKING_FAST", "AI_THINKING_STRONG", "EVIDENCE_BUCKET"]


def read_env(path: Path) -> dict[str, str]:
    if not path.exists():
        sys.exit(f"{path} not found: production values are read from the repo-root .env")
    values = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key] = value
    return values


def main() -> int:
    values = read_env(ROOT / ".env")
    missing = [k for k in SECRET_KEYS[:3] if not values.get(k)]
    if missing:
        sys.exit(f"Missing in .env: {', '.join(missing)}")
    if "supabase.co" not in values["SUPABASE_URL"]:
        sys.exit(f"SUPABASE_URL is {values['SUPABASE_URL']}, not the cloud project: refusing to deploy")

    SECRETS_FILE.write_text("".join(f"{k}={values.get(k, '')}\n" for k in SECRET_KEYS))
    SECRETS_FILE.chmod(0o600)

    env = dict(os.environ, HYPERDRIVE_ID=HYPERDRIVE_ID, CORS_ORIGINS=CORS_ORIGINS)
    env.update({k: values[k] for k in PLAIN_KEYS if values.get(k)})
    cmd = ["pnpm", "deploy:worker", "--secrets-file", SECRETS_FILE.name]
    if "--dry-run" in sys.argv:
        cmd.append("--dry-run")

    result = subprocess.run(cmd, cwd=API_DIR, env=env, capture_output=True, text=True)
    output = result.stdout + result.stderr
    for key in SECRET_KEYS[1:]:
        if values.get(key):
            output = output.replace(values[key], "***")
    print(output[-3000:])
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
