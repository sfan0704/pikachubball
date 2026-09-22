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

# `db start` is a no-op when the local database is already running.
supabase db start
supabase db reset --local
supabase test db --local
