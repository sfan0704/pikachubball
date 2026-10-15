#!/usr/bin/env bash
# A failed production smoke check leaves recovery with the owner.
set -euo pipefail

cat >> "${GITHUB_STEP_SUMMARY:?GitHub step summary path is required}" <<EOF
## Production smoke check failed

The owner must inspect the failed checks and restore the last verified good deployment.

[Manual rollback runbook](https://github.com/${GITHUB_REPOSITORY:?Repository is required}/blob/main/docs/runbooks/restore-and-rollback.md)

This workflow does not change production traffic or the database.
EOF
