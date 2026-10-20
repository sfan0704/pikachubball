# Target state changelog

One line per change to [the target state](target-state.md): the date, what changed, and the pull request. The reasoning is in the pull request.

- 2026-10-19 · A deploy without a merge starts by re-running CI on `main`'s newest commit (a fresh *Deploy* run with current secrets), not by re-running an old *Deploy* run · CAR-142 (PR pending)
- 2026-10-19 · Deploy on merge: pull requests run checks only (plus a migration order check); when CI passes on a `main` commit, the Deploy workflow checks drift, migrates and deploys that exact commit with the Vercel CLI. No `production` branch, deploy key, approval or manual release · CAR-140 (PR pending)
- 2026-10-14 · Failed production smoke checks link the recovery runbook; the owner manually restores the last verified good deployment, and automation never changes production traffic · CAR-100 (PR pending)

- 2026-10-07 · First agreed version, moved into the repository from Notion · #16
- 2026-10-07 · Key rotation is configured with `ENCRYPTION_KEY_VERSION` · #27
- 2026-10-08 · Runbooks live in `docs/runbooks/`; reference docs in `docs/reference/` · #35
- 2026-10-10 · The user's leagues come from the teams and leagues calls together, with the league status rules · #83
- 2026-10-10 · At rollover, the leagues are rechecked at most once a day while Yahoo lists only finished ones · #84
- 2026-10-10 · `user_leagues` stores a status (preseason, active or finished) instead of only whether a league is finished · #89
- 2026-10-11 · The weekly keep-alive and schema dump run unattended as a `maintenance` database role that reads no rows · #96
- 2026-10-11 · Define remote worker lifecycle and authority; distinguish pending hosted delivery from verified state and the owner-only HTTPS exception · #93
- 2026-10-12 · A review environment (the build, a throwaway stack, synthetic users and the stand-in on the CI runner or worker) for seeing changes working; Vercel previews stay build-only · #101

- 2026-10-14 · Protected requests verify the caller’s active Supabase session to reject copied cookies immediately after logout; migrate before deploying the code · #108 (CAR-132)
- 2026-10-19 · No hosted dev; one baseline migration; releases check prod for drift and migrate with the database password only, with project refs written in the workflows · CAR-138 (PR pending)
