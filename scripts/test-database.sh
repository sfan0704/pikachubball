#!/usr/bin/env bash
# Local tier: rebuild a disposable Supabase database from the committed
# migrations and run the pgTAP suite in supabase/tests. Never touches a hosted
# project: every Supabase CLI call is pinned to the local stack.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Run this through npm (npm run test:db) after npm ci." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start it (for example: colima start) and retry." >&2
  exit 1
fi

# Postgres plus the Auth and Data API services the isolation tests call through
# Kong. `start` is a no-op when anything is already running, so a database-only
# stack left by `supabase db start` is stopped first.
if supabase status -o env >/dev/null 2>&1 && ! supabase status -o env | grep -q '^API_URL='; then
  supabase stop --no-backup
fi
supabase start \
  -x studio,imgproxy,mailpit,realtime,storage-api,edge-runtime,logflare,vector,supavisor,postgres-meta
supabase db reset --local
supabase test db --local

# Local stack values only; the check below refuses anything but loopback.
SUPABASE_URL="$(supabase status -o env | sed -n 's/^API_URL="\(.*\)"$/\1/p')"
SUPABASE_PUBLISHABLE_KEY="$(supabase status -o env | sed -n 's/^PUBLISHABLE_KEY="\(.*\)"$/\1/p')"
SUPABASE_DB_URL="$(supabase status -o env | sed -n 's/^DB_URL="\(.*\)"$/\1/p')"
case "$SUPABASE_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Refusing to run Data API tests against '$SUPABASE_URL'." >&2; exit 1 ;;
esac
export SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_DB_URL
vitest run --config vitest.database.config.ts
