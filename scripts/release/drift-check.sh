#!/usr/bin/env bash
# Release step: stop before migrating production if its schema isn't exactly
# what replaying the migrations it records produces (docs/runbooks/release.md).
# Reads production in read-only transactions; rebuilds the replay in this
# checkout's own disposable stack. Changes nothing in production.
set -euo pipefail

cd "$(dirname "$0")/../.."

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Run this through npm (npm run release:drift) after npm ci." >&2
  exit 1
fi

# shellcheck source=scripts/workspace-stack.sh
. scripts/workspace-stack.sh
start_workspace_stack

state="$WORKSPACE_SUPABASE_DIR/production-state.json"
node scripts/release/drift-cli.mts read-production "$state"
replay_dir="$(node scripts/release/drift-cli.mts replay "$state")"
supabase --workdir "$replay_dir" db reset --local --no-seed
node scripts/release/drift-cli.mts compare "$state"
