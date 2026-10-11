#!/usr/bin/env bash
# Builds nothing: run `npm run build` first. Starts this workspace's local stack
# with 14 seeded managers and the production build, runs the load test, and
# stops only the processes it started.
set -euo pipefail

cd "$(dirname "$0")/.."

eval "$(node scripts/workspace.mts --shell)"
LOG="$WORKSPACE_SUPABASE_DIR/load-stack.log"
BASE="http://localhost:$WORKSPACE_LOAD_PORT"

# Stops a process and everything it started, and nothing else.
stop_tree() {
  local child
  for child in $(pgrep -P "$1" || true); do
    stop_tree "$child"
  done
  kill "$1" 2>/dev/null || true
}

PORT="$WORKSPACE_LOAD_PORT" STANDIN_PORT="$WORKSPACE_LOAD_STANDIN_PORT" SEED_COUNT=14 \
  bash scripts/dev-local.sh --built > "$LOG" 2>&1 &
STACK_PID=$!
trap 'stop_tree $STACK_PID' EXIT

for _ in $(seq 1 90); do
  curl -sf "$BASE/api/health" >/dev/null && break
  sleep 5
done
curl -sf "$BASE/api/health" >/dev/null || { echo "The stack did not start; see $LOG" >&2; exit 1; }

LOAD_BASE_URL="$BASE" LOAD_STANDIN_URL="http://127.0.0.1:$WORKSPACE_LOAD_STANDIN_PORT" \
  npx tsx scripts/load-test.ts
