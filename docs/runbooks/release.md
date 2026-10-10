# Release and scheduled jobs

Merging to `main` migrates the dev database and Vercel deploys `main` to dev. A release moves tested work to production. A weekly job keeps the free production database awake and keeps a dump of its schema. The workflows are in `.github/workflows` and stay switched off until the one-time setup below is done.

## One-time setup

1. **Environments** (Settings → Environments):
   - `dev`: secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (dev database) and `SUPABASE_PROJECT_REF` (`ocqdxmfpezxpgutoicyh`).
   - `production`: the same three secrets for the production project (`fpdwtpwpmxsbgjxizuxa`), `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (for the keep-alive read), and `PRODUCTION_DEPLOY_KEY`: the private half of a deploy key with write access that is allowed to push the `production` branch. Set **required reviewers** to the owner and limit **deployment branches** to `main`.
2. **The `production` branch**: create it from `main`, make it Vercel's production branch, and protect it so only the deploy key can push, fast-forward only.
3. **Switch on**: set the repository variable `RELEASE_AUTOMATION` to `true` (Settings → Secrets and variables → Actions → Variables).

## Day to day

- **A change reaches dev** by merging the pull request. If it changes `supabase/migrations`, *Migrate dev* applies it; a failure shows as a red run and a GitHub notification, and the database is left as the migration left it (migrations are backward compatible, so the running app keeps working).
- **Release**: test on dev, then Actions → Release → Run workflow (from `main`). The *migrate* job waits for your approval, applies the migrations to production, and the *promote* job (also approved) fast-forwards `production` to the tested commit, tags it `vYYYY.M.N` and publishes release notes generated from the merged pull request titles. Vercel deploys production when `production` moves. Only one release runs at a time.
- **If a release fails** after the migration, the schema is already ahead of the deployed app, which is safe. Fix forward and run the release again. To undo a bad deploy see [restore and rollback](restore-and-rollback.md).

## Scheduled jobs

*Scheduled* runs every Monday: it reads from the production database (so the project doesn't pause after a quiet week) and uploads `schema.sql` as the `production-schema` artifact for 90 days. Neither calls Yahoo. If the project has already paused, restore it first (see restore and rollback), then run *Scheduled* once by hand.
