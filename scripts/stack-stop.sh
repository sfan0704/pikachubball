#!/usr/bin/env bash
# Stops this checkout's local Supabase stack and deletes its data. Never touches
# another workspace's stack (scripts/workspace.mts).
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck source=scripts/workspace-stack.sh
. scripts/workspace-stack.sh
require_workspace_ports
sb stop --no-backup
