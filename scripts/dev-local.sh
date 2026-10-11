#!/usr/bin/env bash
# Local development: the app against a throwaway Supabase stack and the Yahoo
# stand-in. No hosted credentials, no network access to Yahoo. Refuses to run in
# production and refuses anything but loopback addresses. Each checkout gets its
# own stack and ports (scripts/workspace.mts). With --built it serves
# the production build (npm run build) instead of the development server, which
# is how the browser tests run it.
set -euo pipefail

BUILT=false
[ "${1:-}" = "--built" ] && BUILT=true

cd "$(dirname "$0")/.."

if [ "${NODE_ENV:-}" = "production" ]; then
  echo "Local mode never runs with NODE_ENV=production." >&2
  exit 1
fi
if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Run npm ci first." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start it (for example: colima start) and retry." >&2
  exit 1
fi

# shellcheck source=scripts/workspace-stack.sh
. scripts/workspace-stack.sh
start_workspace_stack
sb db reset --local

SUPABASE_URL="$(workspace_status API_URL)"
SUPABASE_PUBLISHABLE_KEY="$(workspace_status PUBLISHABLE_KEY)"
SUPABASE_DB_URL="$(workspace_status DB_URL)"
case "$SUPABASE_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Refusing to use '$SUPABASE_URL' in local mode." >&2; exit 1 ;;
esac

STANDIN_PORT="${STANDIN_PORT:-$WORKSPACE_DEV_STANDIN_PORT}"
PORT="${PORT:-$WORKSPACE_DEV_PORT}"
# The built server serves the compiled client when NODE_ENV is not "development".
if $BUILT; then export NODE_ENV=test; else export NODE_ENV=development; fi
export LOCAL_STACK=true PORT
export APP_ORIGIN="http://localhost:$PORT"
export SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_DB_URL
export ENCRYPTION_KEY="${ENCRYPTION_KEY:-$(printf '1f%.0s' $(seq 1 32))}"
# Plain http locally, whatever a hosted .env.local says; variables set here win over that file.
export DEV_HTTPS_CERT= DEV_HTTPS_KEY=
export YAHOO_CLIENT_ID=local YAHOO_CLIENT_SECRET=local
export YAHOO_PROVIDER_REDIRECT_URI="$APP_ORIGIN/api/auth/yahoo/fantasy/callback"
export YAHOO_API_BASE_URL="http://127.0.0.1:$STANDIN_PORT/fantasy/v2"
export YAHOO_OAUTH_BASE_URL="http://127.0.0.1:$STANDIN_PORT"

STANDIN_PORT="$STANDIN_PORT" npx tsx scripts/yahoo-standin.ts &
STANDIN_PID=$!
trap 'kill $STANDIN_PID 2>/dev/null || true' EXIT

npx tsx scripts/seed-local.ts
echo
echo "Sign in as a seeded manager: http://localhost:$PORT/api/dev/login?user=a  (or user=b)"
if $BUILT; then
  node dist/index.mjs
else
  npx tsx --watch server/index.ts
fi
