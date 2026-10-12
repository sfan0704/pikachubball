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
# Kong, in this checkout's own stack (scripts/workspace.mts), so another
# workspace's database is never reset.
# shellcheck source=scripts/workspace-stack.sh
. scripts/workspace-stack.sh
start_workspace_stack
sb db reset --local
# The real tests folder, not a link: pgTAP runs in a container that mounts it.
sb test db --local "$PWD/supabase/tests"

# Local stack values only; the check below refuses anything but loopback.
SUPABASE_URL="$(workspace_status API_URL)"
SUPABASE_PUBLISHABLE_KEY="$(workspace_status PUBLISHABLE_KEY)"
SUPABASE_DB_URL="$(workspace_status DB_URL)"
case "$SUPABASE_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Refusing to run Data API tests against '$SUPABASE_URL'." >&2; exit 1 ;;
esac
export SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_DB_URL
vitest run --config vitest.database.config.ts
