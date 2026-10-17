# Activate hosted dev

CAR-94 moves `main` to an owner-only hosted dev deployment and leaves `production` serving league members. This is a reviewable transition plan, not evidence that the switch has happened. Obtain the owner's approval before changing deployment/auth settings or the production branch; preserve the approval gates in [release](release.md) and the [worker authority contract](../remote-development.md#authority-and-escalation).

## Targets and verified preparation

| Item | Target / observation |
| --- | --- |
| Repository | `sfan0704/pikachubball` |
| Vercel project/team | `prj_izIWbhRIRM77Kij7YoH8e8ciBkPT` / `team_h0Yl4tlqpwkycY1Wl2ZppyOo` |
| Dev Supabase | `ocqdxmfpezxpgutoicyh` |
| Dev origin | `https://pikachubball-git-main-sfan0704s-projects.vercel.app` |
| Dev application callback | `https://pikachubball-git-main-sfan0704s-projects.vercel.app/api/auth/callback` |
| Dev Fantasy refresh redirect | `https://pikachubball-git-main-sfan0704s-projects.vercel.app/api/auth/yahoo/fantasy/callback` |
| Current production origin | `https://pikachubball.vercel.app` |
| Verified served production commit | `f0c8ac4e3d12dff1bb7070e4c713a68999ed5c44`; re-read health immediately before the transition |
| Current production branch | `ceb61b4b78629c3871224a4112d7e55bbc876fc5`, unprotected; do not switch Vercel to this stale branch |

On 2026-10-16 (America/New_York), metadata verified seven Development-only rows, including the owner's sensitive `ENCRYPTION_KEY`, and seven separate Production-only rows. No Preview rows were present. Variable values were not read. Preserve the existing dev key to retain access to its encrypted Yahoo connection.

The [main-only dev migration run](https://github.com/sfan0704/pikachubball/actions/runs/38988510977) succeeded at `f0c8ac4e3d12dff1bb7070e4c713a68999ed5c44`. Read-only follow-up verified all seven canonical migration IDs and the session-check RPC: zero arguments, empty search path, executable by `authenticated`, and not executable by PUBLIC, `anon`, `service_role` or `maintenance`. With no signed session context it returns false. This is not an owner sign-in or replayed-cookie test.

## Stop gates

- The owner must approve the exact transition commit and production branch/routing changes. Recheck current deployment, branches and required CI; the observations above can become stale.
- Establish and verify `production` branch protection and the release deploy key's permitted push path. Preserve required reviewers and the main-only policy on GitHub's Production environment.
- Verify the production environment's required release credential names and readiness through the owner's settings or appropriately scoped metadata access. The current worker receives HTTP 403 on that secret-name inventory; it cannot claim readiness. Never retrieve secret values to satisfy this check.
- Keep `RELEASE_AUTOMATION` disabled until CAR-83's complete setup and approval checks pass. Hosted dev activation does not authorize a production migration or enable scheduled work.

## Approved transition sequence

1. Record the current production deployment URL and exact health commit, and a passing smoke check. Confirm `production` can fast-forward to that commit without discarding any work; stop on divergence. Advance it to the verified served commit through the owner-approved protected path, then recheck its head. Do not release the newer dev candidate to production as part of this step.
2. Confirm Vercel Authentication is enabled for branch deployments (`all_except_custom_domains`) and the intended dev branch domain is protected. Configure dev Supabase's site URL to the dev origin and its redirect allowlist to the single exact application callback above. Keep the shared Yahoo app's production and Supabase callbacks intact; separately verify the dev refresh redirect is registered before owner login.
3. Change Vercel Production branch tracking from `main` to the verified `production` branch using an authorized control. The existing production deployment must remain the served version. Recheck public health immediately; stop and use [manual rollback](restore-and-rollback.md) if its commit or health changes unexpectedly. The current connector does not expose the branch-tracking update, so the owner may need the dashboard for this step.
4. Update the seven existing dev variable rows from Development-only staging to `target=["preview"]`, `gitBranch="main"`. Use metadata-only updates by their freshly verified IDs, omitting `value` and preserving variable types. Never select Production or generic Preview. Re-read all row metadata and confirm the seven production rows retain their IDs/types/scopes.
5. Deploy the reviewed dev commit from `main`. Verify the deployment URL, target and exact commit, protected anonymous access, exact auth redirects, no-store responses and security headers. Run smoke with the established protection bypass through its approved secret path; keep bypass values out of evidence.
6. Have the owner sign in at the protected dev URL and verify leagues, refresh, logout and the required session-boundary checks. Real Yahoo remains a manual owner check. Verify a fresh feature preview has no Supabase/Yahoo credentials or sign-in. Capture sanitized evidence and update CAR-94; do not close it on a build or metadata observation alone.

## If a checkpoint fails

Stop before the next step. Preserve the current production deployment and record the exact failing checkpoint, source/head commit and configuration metadata. Keep production variables and approval gates intact. Roll back a served production regression through the owner-run procedure; do not reapply old migrations, generate a replacement dev key or delete stored connections. Reverting dev auth URL settings or moving dev rows back to their recorded staging scopes is a configuration rollback and needs the same owner authority as the forward change.
