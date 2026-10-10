#!/usr/bin/env bash
# Builds nothing: run `npm run build` first. Starts the local stack with 14 seeded
# managers and the production build, runs the load test, and stops everything.
set -euo pipefail

cd "$(dirname "$0")/.."

PORT=5071 STANDIN_PORT=5097 SEED_COUNT=14 bash scripts/dev-local.sh --built > /tmp/load-stack.log 2>&1 &
STACK_PID=$!
trap 'pkill -P $STACK_PID 2>/dev/null || true; kill $STACK_PID 2>/dev/null || true; pkill -f "dist/index.mjs" || true; pkill -f yahoo-standin || true' EXIT

for _ in $(seq 1 90); do
  curl -sf http://localhost:5071/api/health >/dev/null && break
  sleep 5
done
curl -sf http://localhost:5071/api/health >/dev/null || { echo "The stack did not start; see /tmp/load-stack.log" >&2; exit 1; }

npx tsx scripts/load-test.ts
