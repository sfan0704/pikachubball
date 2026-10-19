# Release and scheduled jobs

There is no hosted dev: a change is checked on its pull request (CI and the review environment) and merged to `main`, and a release moves it to production. A weekly job keeps the free production database awake and keeps a dump of its schema. The workflows are in `.github/workflows` and stay switched off until the one-time setup below is done.

The production project ref (`fpdwtpwpmxsbgjxizuxa`) and its session pooler host are written in the workflows and `config/hosted-contract.json`; they are not secrets. The only credentials GitHub holds are below.

## One-time setup

1. **Environments** (Settings → Environments):
   - `production`: secrets `SUPABASE_DB_PASSWORD` (the production database password) and `PRODUCTION_DEPLOY_KEY`: the private half of a deploy key with write access that is allowed to push the `production` branch. Set **required reviewers** to the owner and limit **deployment branches** to `main`. No Supabase access token: the release reaches the database through its session pooler with TLS, using the password alone, and masks the encoded password and connection URL before running the CLI. Recheck the pooler host in the project's Connect dialog if the project moves regions or is recreated.
   - `maintenance`: for the weekly *Scheduled* jobs, which run without approval. **No required reviewers**; deployment branches limited to `main`. Secret: `MAINTENANCE_DB_PASSWORD`. That password belongs to the production database's `maintenance` role, which reads no rows and can change nothing (every table forces row-level security, with policies for signed-in users only). Give the role its password once, in the production SQL editor, with a long random value that is used nowhere else:

     ```sql
     alter role maintenance with login password '<new random password>';
     ```

     To revoke it, run `alter role maintenance with nologin;`. Never put the `postgres` password in this environment.
2. **The `production` branch**: create it from `main`, make it Vercel's production branch, and protect it so only the deploy key can push, fast-forward only.
3. **Switch on**: set the repository variable `RELEASE_AUTOMATION` to `true` (Settings → Secrets and variables → Actions → Variables).

## Day to day

- **A change is ready to release** once its pull request is merged and `main` is green. Merging changes nothing hosted.
- **Release**: Actions → Release → Run workflow (from `main`). The *migrate* job waits for your approval, then:
  1. **Checks production for drift** (`npm run release:drift`). It reads which migrations production records and a digest of its public schema, in read-only transactions, then replays exactly those migrations on a throwaway local database and compares. Supabase-managed objects (extension objects, the platform's event-trigger functions) are left out. If production records a migration this commit doesn't have, or its schema differs from the replay, the job fails with `mismatch` and nothing in production has changed. Find out who changed production and how before going on; for a database with no users yet, the [production reset](production-reset.md) is the clean way back.
  2. **Applies the migrations** (`npm run release:migrate`): `supabase db push` through the session pooler.

  The *promote* job (also approved) then fast-forwards `production` to the commit, tags it `vYYYY.M.N` and publishes release notes generated from the merged pull request titles. Vercel deploys production when `production` moves, and the *Smoke check* runs against it. Only one release runs at a time.
- **If a release fails** after the migration, the schema is already ahead of the deployed app, which is safe. Fix forward and run the release again. To undo a bad deploy see [restore and rollback](restore-and-rollback.md).

## Scheduled jobs

*Scheduled* runs every Monday in the `maintenance` environment, as the `maintenance` database role: it queries the production database (so the project doesn't pause after a quiet week) and uploads `schema.sql`, from `pg_dump --schema-only`, as the `production-schema` artifact for 90 days. Neither calls Yahoo, and neither needs approval. Before `RELEASE_AUTOMATION` is on, check the setup with Actions → Scheduled → Run workflow, from `main`. If the project has already paused, restore it first (see restore and rollback), then run *Scheduled* once by hand.
