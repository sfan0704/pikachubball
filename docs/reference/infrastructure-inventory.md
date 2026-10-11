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
| Supabase development project | `Pikachu Basketball Development` / `ocqdxmfpezxpgutoicyh` |
| Repository-local Supabase ID | `pikachubball` |

The basketball project references differ from both Card Benefits Supabase projects, and the Vercel project differs from Card Benefits'. Production secrets are scoped only to basketball production; preview builds receive no production authentication, database or Yahoo credentials.

## Environment tiers

The default development and CI environment is the disposable Supabase stack with the implemented offline Yahoo stand-in. It needs no real Yahoo sign-in. Real Yahoo validation remains manual, using the dedicated dev Supabase project.

| Resource | Local / CI | Dev | Prod |
| --- | --- | --- | --- |
| Supabase project | Disposable CLI stack, `project_id = "pikachubball"` | `Pikachu Basketball Development` / `ocqdxmfpezxpgutoicyh` | `Pikachu Basketball` / `fpdwtpwpmxsbgjxizuxa` |
| Supabase region | Docker on worker or laptop | AWS North Virginia (`us-east-1`), Free | AWS North Virginia (`us-east-1`), Free |
| Yahoo app | None; recorded-response stand-in | `PikachuBball` (`VZxFFbzH`) | `PikachuBball` (`VZxFFbzH`) |
| Sign-in | Seeded synthetic managers via `/api/dev/login` | Owner's real Yahoo sign-in | League members' real Yahoo sign-in |
| Application callback | No Yahoo callback | Local HTTPS exception: `https://localhost:5001/api/auth/callback`; hosted dev callback pending CAR-94 | `https://pikachubball.vercel.app/api/auth/callback` |
| Secret location | Generated local/test values only | Owner-managed `.env.local` exception; hosted branch scope pending | Vercel Production environment |
| Migrations | `npm run test:db`, disposable only | Manual main-only workflow verified; automatic activation pending | Approval-protected release workflow, activation pending |

### Verified state and remaining activation (2026-10-11)

- [CAR-94](https://linear.app/card-benefits/issue/CAR-94): latest discussion at 00:25 UTC records `production` created at `ceb61b4b78629c3871224a4112d7e55bbc876fc5`. Vercel still follows `main` for production. Hosted dev configuration, stable origin, Vercel Authentication, exact callback allowlist and branch switch remain pending. Seven server variables were verified production-only; verify isolation on a fresh preview before claiming deployment-level acceptance.
- [CAR-83](https://linear.app/card-benefits/issue/CAR-83): latest discussion at 15:59 UTC records a [successful manual dev migration](https://github.com/sfan0704/pikachubball/actions/runs/38153494925) through the verified dev session pooler with TLS. `RELEASE_AUTOMATION` remains unset; hosted main/dev and an approved production release remain unverified.
- The GitHub production environment requires owner approval and allows deployment from `main` only. Preserve that protection. A branch or merged workflow is not evidence of an activated release.
- Feature previews remain build-only, with no Supabase/Yahoo credentials or sign-in. Functional preview design belongs to CAR-128; implementation belongs to CAR-129.

### Shared Yahoo boundary

Dev and prod share `PikachuBball` (`VZxFFbzH`), its secret, rate limits and revocation. Local/CI has no Yahoo app, provider secret or real redirect. `PikachuBball - Dev` (`si6rpgJq`) and `Fantasy` (`rVqtn8Pt`) returned 403 for Fantasy access in the recorded verification; do not configure them as replacements.

The hosted Supabase callbacks are `https://ocqdxmfpezxpgutoicyh.supabase.co/auth/v1/callback` (dev) and `https://fpdwtpwpmxsbgjxizuxa.supabase.co/auth/v1/callback` (prod). The documented refresh redirects are `https://localhost:5001/api/auth/yahoo/fantasy/callback` for the local dev exception and `https://pikachubball.vercel.app/api/auth/yahoo/fantasy/callback` for prod. Nothing is served at these refresh paths, but token refresh sends them; removing them breaks access. Hosted dev must establish its own exact origin and redirect before activation.

Production switched from `PikachuBball - Local` (`i19hJ8X4`) to `VZxFFbzH` on 2026-10-10, verified from the sign-in redirect's client ID. Since CAR-81, Supabase requests `fspt-r` and the callback stores its Yahoo tokens; there is no second connect step. Historical redirect registrations include a legacy Replit URI; this inventory does not authorize deleting registrations.

The Supabase organization is on the Free plan, which allows two active projects. Both basketball projects are active, and the two Card Benefits projects are paused. Restoring a Card Benefits project requires pausing one basketball project first.

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
