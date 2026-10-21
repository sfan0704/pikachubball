# Release and scheduled jobs

There is no hosted dev and no release step: a change is checked on its pull request (CI and the review environment), and merging it to `main` takes it to production once CI passes on the merged commit. A weekly job keeps the free production database awake and keeps a dump of its schema. The workflows are in `.github/workflows` and stay switched off until the one-time setup below is done.

The production project ref (`fpdwtpwpmxsbgjxizuxa`), its session pooler host and the Vercel project and team IDs are written in the workflows and `config/hosted-contract.json`; they are not secrets. The only credentials GitHub holds are below.

## One-time setup

1. **Environments** (Settings → Environments):
   - `production`: secrets `SUPABASE_DB_PASSWORD` (the production database password) and `VERCEL_TOKEN` (a Vercel token scoped to the `pikachubball` project). Limit **deployment branches** to `main`. No required reviewers: every merge that passes CI goes live (owner default, CAR-140). Adding the owner as a required reviewer makes each deploy wait for approval instead. No Supabase access token: the deploy reaches the database through its session pooler with TLS, using the password alone, and masks the encoded password and connection URL before running the CLI. Recheck the pooler host in the project's Connect dialog if the project moves regions or is recreated.
   - `maintenance`: for the weekly *Scheduled* jobs, which run without approval. **No required reviewers**; deployment branches limited to `main`. Secret: `MAINTENANCE_DB_PASSWORD`. That password belongs to the production database's `maintenance` role, which reads no rows and can change nothing (every table forces row-level security, with policies for signed-in users only). Give the role its password once, in the production SQL editor, with a long random value that is used nowhere else:

     ```sql
     alter role maintenance with login password '<new random password>';
     ```

     To revoke it, run `alter role maintenance with nologin;`. Never put the `postgres` password in this environment.
2. **Branch ruleset on `main`**: require pull requests with every CI check green, squash only, and **require branches to be up to date before merging**, so two pull requests that each pass alone are tested together before either reaches `main`.
3. **Vercel**: `main` stays the production branch, but `vercel.json` turns off Git deploys from it (`git.deploymentEnabled.main: false`), so only the *Deploy* workflow deploys production. Feature branches still build previews with no Supabase or Yahoo settings.
4. **Switch on**: set the repository variable `RELEASE_AUTOMATION` to `true` (Settings → Secrets and variables → Actions → Variables).

## Day to day

Merge a pull request. When CI passes on the merged commit, *Deploy* runs for exactly that commit:

1. **Checks it is the newest.** Each deploy is tagged `vYYYY.M.N`. A commit that doesn't contain every tagged one is older than what production runs, so the run is skipped with a notice: older code never replaces newer.
2. **Checks production for drift** (`npm run release:drift`). It reads which migrations production records and a digest of its public schema, in read-only transactions, then replays exactly those migrations on a throwaway local database and compares. Supabase-managed objects (extension objects, the platform's event-trigger functions) are left out. If production records a migration this commit doesn't have, or its schema differs from the replay, the job fails with `mismatch` and nothing in production has changed. Find out who changed production and how before going on; for a database with no users yet, the [production reset](production-reset.md) is the clean way back.
3. **Applies the migrations** (`npm run release:migrate`): `supabase db push` through the session pooler. A merge with no new migration changes nothing here. If it fails, nothing is deployed.
4. **Deploys this commit** with the Vercel CLI (`vercel build --prod` and `vercel deploy --prebuilt --prod`), never the branch's latest commit, and sets `DEPLOYED_COMMIT` so `/api/health` reports it.
5. **Tags it** `vYYYY.M.N` and publishes release notes generated from the merged pull request titles.
6. **Smoke checks production** at `https://pikachubball.vercel.app`, expecting this commit. A failure links the [manual rollback runbook](restore-and-rollback.md); automation never changes production traffic.
7. **Checks production's configuration** (`npm run release:config`): the Yahoo sign-in provider and scopes, read in a read-only transaction with the same database password, and the Vercel variable names and scopes, read with the same Vercel token and decryption off. A `mismatch` fails the run, which notifies the owner; the app is already live, so see [configuration checks](configuration-checks.md) for what each check means and fix the setting by hand.

Only one deploy runs at a time, in merge order. When several merges queue, GitHub cancels the pending runs in between; the newest commit contains every earlier one and applies all their migrations.

- **If a deploy fails after the migration,** the schema is ahead of the deployed app, which is safe because migrations are backward compatible. Fix forward with another merge, or re-run the failed run. Only re-run it if no `production` secret has changed since it first ran: a re-run kept using the replaced database password in CAR-139. After changing a secret, start a fresh run as below.
- **To start a deploy without a merge** (after the [production reset](production-reset.md), or once `RELEASE_AUTOMATION` is switched on): Actions → CI, open the latest run for `main`'s newest commit, and choose **Re-run all jobs**. When it passes, it starts a fresh *Deploy* run for that commit, which uses the current secrets. Don't re-run an old *Deploy* run for this: after a secret changes, a re-run can keep using the old value.
- **Removing a column or table takes two merges** (expand and contract): first stop using it, then drop it in a later migration. The code live while a migration runs must keep working with the schema after it.

## Scheduled jobs

*Scheduled* runs every Monday in the `maintenance` environment, as the `maintenance` database role: it queries the production database (so the project doesn't pause after a quiet week) and uploads `schema.sql`, from `pg_dump --schema-only`, as the `production-schema` artifact for 90 days. Neither calls Yahoo, and neither needs approval. There is no scheduled drift check: every deploy checks for drift before it changes anything. Before `RELEASE_AUTOMATION` is on, check the setup with Actions → Scheduled → Run workflow, from `main`. If the project has already paused, restore it first (see restore and rollback), then run *Scheduled* once by hand.
