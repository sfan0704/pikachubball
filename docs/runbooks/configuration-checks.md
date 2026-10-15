# Configuration checks

CAR-100's metadata comparison is `npm run config:check -- <snapshot.json> <baseline.json>`. It exits nonzero on a mismatch, unavailable evidence, wrong project, invalid input or a capture older than 24 hours (or more than five minutes in the future). It prints only criterion names and outcomes; in Actions it also writes those to the job summary. A failed workflow notifies the owner through GitHub. No command repairs settings or changes production traffic.

The checked expectations live in `config/hosted-contract.json`: basketball project/team identities, exact site/callback URLs, server-variable names and scope isolation. Dev currently uses the documented owner-only localhost HTTPS exception; hosted dev origin/activation is still CAR-94. Update this contract in the PR that approves that change. Main-specific preview variables are dev-only; feature previews remain build-only. Shared dev/prod variable rows, generic preview leaks, browser-prefixed server variables and runtime admin credentials fail.

## Schema reference

On a supported Docker worker, from a clean checkout:

```sh
npm run config:baseline -- .workspace/config-baseline.json
```

This first runs `npm run test:db`, rebuilding this checkout's isolated database from the committed migrations and running the database tests. It then queries only that workspace's container. The reference records the source commit, digest of ordered migration filenames/bytes, digest of `scripts/config-check/schema.sql`, and schema fingerprint. A changed migration or query invalidates an older reference. Keep the reference with the run's artifacts; never generate it from a hosted database.

The SQL fingerprint covers application tables/views/sequences, column types/nullability/defaults, constraints, indexes, RLS flags/policies, triggers, function definitions and grants. OIDs and extension-owned platform objects are excluded. The database returns a SHA-256 digest, not definitions or user rows. This does not replace a data integrity check, migration compatibility testing, or checking platform-owned Auth schema.

## Capture without credential values

```sh
npm run config:capture -- prod .workspace/config-prod.json auth-metadata.json vercel-metadata.json
npm run config:check -- .workspace/config-prod.json .workspace/config-baseline.json
```

Use `dev` for the other project. A project-scoped `CONFIG_SUPABASE_ACCESS_TOKEN` is injected externally, never in command arguments or `.env.local`. Its only requests are `POST /v1/projects/<ref>/database/query` with `read_only: true`. The three SELECT projections read custom-provider metadata, the public schema fingerprint, and migration versions. They never select provider secrets, token tables or user rows. Token access must reach only the intended basketball project; database-query access is needed even though these particular statements are read-only.

Auth and Vercel must be fresh, approved **non-secret projection files** from a trusted read-only metadata source, supplied on the same run. Their shapes are:

```json
{"siteUrl":"https://pikachubball.vercel.app","redirectAllowList":["https://pikachubball.vercel.app/api/auth/callback"]}
```

```json
{"projectId":"prj_izIWbhRIRM77Kij7YoH8e8ciBkPT","teamId":"team_h0Yl4tlqpwkycY1Wl2ZppyOo","variables":[{"key":"APP_ORIGIN","target":["production"],"gitBranch":null}]}
```

The second example shows one row; supply every variable's metadata. Never include `value`, encrypted payloads, provider client secrets or a full platform response. Strict input schemas reject unexpected fields; parse errors are deliberately generic to avoid echoing credentials. The capture records acquisition time; operators must supply newly acquired Auth/Vercel projections, not re-date an old export. A snapshot is trusted evidence only when its acquisition source and run are recorded.

The current Supabase connector exposes safe SQL projections but no selective Auth-config read. The documented `GET /config/auth` response includes secret-bearing fields, so this tool deliberately does not call it. Vercel's metadata access currently returns 403 for the basketball team; there is no authenticated CLI fallback in this worker. Do not widen credentials, decrypt values or invent observations to get a green result. Without either projection, capture/check fails with unavailable evidence.

## Automation and acceptance boundary

The comparator, read-only database capture, isolated reference generation and seeded mismatch tests are implemented. Hosted Auth/Vercel metadata acquisition and deployment/scheduled workflow activation remain pending scoped access and a safe selective Auth projection. This runbook does not claim unattended hosted checks are active. Attach source commit, capture time, acquisition path, schema reference and sanitized check summary to Linear/PR evidence before claiming hosted verification.

Existing CI runs the mismatch tests; its database job also injects catalog drift inside rolled-back transactions (column, RLS, policy, grant, trigger, function, constraint and extra table). No real Yahoo call or hosted write occurs.

Current API references: [read-only database query](https://supabase.com/docs/reference/api/v1-run-query), [Auth configuration response](https://supabase.com/docs/reference/api/v1-get-auth-service-config), and [custom provider configuration](https://supabase.com/docs/guides/auth/custom-oauth-providers). Reviewed 2026-10-14.
