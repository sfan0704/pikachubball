# Infrastructure inventory and isolation boundary

This inventory is sanitized. It records project identifiers and configuration
presence only; no secret values, cookies, provider payloads, or private rows belong
here.

## Existing Card Benefits boundary

The basketball migration must not change any of these resources.

| Resource | Existing identifier |
| --- | --- |
| GitHub repository | `sfan0704/card-benefits` |
| Vercel production origin | `https://card-benefits-snowy.vercel.app` |
| Supabase production project | `Card Benefits US East` / `atgnooivdbdrihxwfelf` |
| Supabase development project | `Card Benefits Development` / `mhppghkxnalfoispkija` |
| Supabase region | AWS North Virginia (`us-east-1`) |
| Repository-local Supabase ID | `card-benefits` |


## Basketball boundary

| Resource | Value |
| --- | --- |
| GitHub repository | `sfan0704/pikachubball` |
| Vercel production origin | `https://pikachubball.vercel.app` |
| Supabase production project | `Pikachu Basketball` / `fpdwtpwpmxsbgjxizuxa` |
| Repository-local Supabase ID | `pikachubball` |

The basketball project references differ from both Card Benefits Supabase projects, and the Vercel project differs from Card Benefits'. Production secrets are scoped only to basketball production; preview builds receive no production authentication, database or Yahoo credentials.

## Environment tiers

There are three tiers and no hosted dev (owner decision, 2026-10-18; supersedes CAR-94). Development and CI use the disposable Supabase stack with the offline Yahoo stand-in and need no real Yahoo sign-in. Pull request checks and the review environment cover what hosted dev was for.

| Resource | Local / CI | Preview | Prod |
| --- | --- | --- | --- |
| Supabase project | Disposable CLI stack, `project_id = "pikachubball"` | None | `Pikachu Basketball` / `fpdwtpwpmxsbgjxizuxa` |
| Supabase region | Docker on worker or laptop | None | AWS North Virginia (`us-east-1`), Free |
| Yahoo app | None; recorded-response stand-in | None | `PikachuBball` (`VZxFFbzH`) |
| Sign-in | Seeded synthetic managers via `/api/dev/login` | None | League members' real Yahoo sign-in |
| Application callback | No Yahoo callback | None | `https://pikachubball.vercel.app/api/auth/callback` |
| Secret location | Generated local/test values only | None | Vercel Production environment; GitHub `production` and `maintenance` environments for the database |
| Migrations | `npm run test:db`, disposable only | None | *Deploy* workflow after CI passes on `main`, with a drift check first; activation pending |

### Verified state and remaining activation (2026-10-19)

- CAR-138 replaced the seven migrations with one baseline (`20261019000000_baseline.sql`), removed *Migrate dev*, and made the release migrate production with `SUPABASE_DB_PASSWORD` only, after a drift check. Project refs are written in the workflows.
- The read-only check on 2026-10-17 (CAR-100) found production's schema digest differing from the migrations it recorded, including the platform's `public.rls_auto_enable()` and function privileges. The release drift check now ignores the platform's event-trigger functions, and the baseline sets every privilege explicitly. Production still holds the old seven-migration history, so a release stops at the drift check until the [production reset](../runbooks/production-reset.md) runs (CAR-139, owner only).
- CAR-140 replaced the manual *Release* workflow (and its `production` branch and deploy key) with *Deploy*, which runs when CI passes on a `main` commit: drift check, migrate, Vercel CLI deploy of that commit, tag, smoke check. `vercel.json` turns off Vercel's Git deploys from `main`, so once it merges production gets no new deploy until *Deploy* is switched on.
- CAR-139 (2026-10-19) activated it: production was reset to the baseline, `RELEASE_AUTOMATION` is `true`, and the first *Deploy* (`v2026.10.1`) and a *Scheduled* run passed. The `Pikachu Basketball Development` project is deleted, its Vercel Development-scope variables and the `dev` GitHub environment are gone, and `PikachuBball` keeps only production redirects.
- The GitHub production environment allows deployment from `main` only. Preserve that limit; pull request jobs must never reach it. A branch or merged workflow is not evidence of an activated release.
- Feature previews remain build-only, with no Supabase/Yahoo credentials or sign-in. Functional preview design belongs to CAR-128; implementation belongs to CAR-129.

### Yahoo boundary

Production uses `PikachuBball` (`VZxFFbzH`), the only Fantasy-activated app. Local/CI has no Yahoo app, provider secret or real redirect. `PikachuBball - Dev` (`si6rpgJq`) and `Fantasy` (`rVqtn8Pt`) returned 403 for Fantasy access in the recorded verification; do not configure them as replacements. `PikachuBball - Dev` and `PikachuBball - Local` (`i19hJ8X4`) are renamed `[deprecated] PikachuBball` because Yahoo refuses to delete them (CAR-141).

The hosted Supabase callback is `https://fpdwtpwpmxsbgjxizuxa.supabase.co/auth/v1/callback`. The documented refresh redirect is `https://pikachubball.vercel.app/api/auth/yahoo/fantasy/callback`. Nothing is served at that path, but token refresh sends it; removing it breaks access.

Production switched from `PikachuBball - Local` (`i19hJ8X4`) to `VZxFFbzH` on 2026-10-10, verified from the sign-in redirect's client ID. Since CAR-81, Supabase requests `fspt-r` and the callback stores its Yahoo tokens; there is no second connect step. Historical redirect registrations include a legacy Replit URI; this inventory does not authorize deleting registrations.

The Supabase organization is on the Free plan, which allows two active projects. Once the retired basketball project is removed, one slot is free for Card Benefits.

## Legacy application inventory

- Deployment: Replit autoscale, port 5000, with the recorded production callback
  `https://pikachubball.replit.app/api/auth/yahoo/callback`.
- Runtime: the Replit file requests Node 20 and PostgreSQL 16. The revived baseline
  uses Node 24 and npm 11.
- Database access: Drizzle ORM over a PostgreSQL `DATABASE_URL`; schema was pushed
  directly with `drizzle-kit push`. No committed migration directory exists.
- Data categories: application users, password hashes for legacy local users,
  Yahoo GUID/display metadata, Yahoo access and refresh tokens, token expiry, and
  encrypted OpenAI credentials.
- Application secrets: session secret, encryption key, Yahoo client ID and client
  secret, database URL, and the callback URI.
- Retention boundary: do not copy raw Yahoo tokens, password hashes, OpenAI keys,
  private user rows, or existing secret values into Supabase, Vercel, GitHub,
  Linear, or documentation. Do not delete the Replit deployment or its database as
  part of migration.
- Initial release data plan: create the new schema from reviewed migrations and let
  the owner authenticate through Yahoo as a fresh identity. Any later legacy-row
  import requires a separate mapping and verification plan.
