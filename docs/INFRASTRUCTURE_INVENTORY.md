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

These values were read from the Card Benefits repository runbooks and Supabase CLI
configuration on 2026-09-12. The repository was read only. No Card Benefits file,
project, deployment, environment variable, provider, or database was changed.

## Basketball target boundary

| Resource | Required value or state |
| --- | --- |
| GitHub repository | `sfan0704/pikachubball` |
| Vercel project | Dedicated project, proposed name `pikachubball` |
| Vercel production origin | Stable HTTPS production alias; record after provisioning |
| Supabase project | One dedicated project, proposed name `Pikachu Basketball` |
| Supabase region | AWS North Virginia (`us-east-1`) when free capacity permits |
| Repository-local Supabase ID | `pikachubball` |
| Production callback | `<stable-origin>/api/auth/yahoo/callback` |
| Preview credentials | None for production Yahoo, Supabase, or database credentials |

The target project references must differ from both Card Benefits Supabase project
references. The Vercel project ID must differ from the Card Benefits Vercel project
ID. Production secrets are scoped only to basketball production. Preview builds use
synthetic configuration and do not receive production authentication, database, or
Yahoo credentials.

## Environment tiers

Decided in CAR-70 on 2026-09-22. A hosted dev tier amends the original "local disposable dev" plan: every useful screen needs live Yahoo Fantasy data, which requires a real Yahoo sign-in through an HTTPS Supabase callback that a local-only stack cannot provide.

| Resource | Local | Dev | Prod |
| --- | --- | --- | --- |
| Supabase project | Disposable CLI stack, `project_id = "pikachubball"` | `Pikachu Basketball Development` / `ocqdxmfpezxpgutoicyh` | `Pikachu Basketball` / `fpdwtpwpmxsbgjxizuxa` |
| Supabase region | Docker on the developer machine or CI | AWS North Virginia (`us-east-1`), Free | AWS North Virginia (`us-east-1`), Free |
| Yahoo Developer app | `PikachuBball` (`VZxFFbzH`), planned | `PikachuBball` (`VZxFFbzH`) | `PikachuBball` (`VZxFFbzH`); sign-in switching from `PikachuBball - Local` (`i19hJ8X4`), CAR-57 |
| Yahoo redirect URI | `http://127.0.0.1:54321/auth/v1/callback` (planned; loopback acceptance untested) | `https://ocqdxmfpezxpgutoicyh.supabase.co/auth/v1/callback` and `https://localhost:5001/api/auth/yahoo/fantasy/callback` | `i19hJ8X4`: the prod Supabase callback. `VZxFFbzH`: the prod Supabase callback, `https://pikachubball.vercel.app/api/auth/yahoo/fantasy/callback`, and a legacy Replit URI |
| Application callback | None | `https://localhost:5001/api/auth/callback` | `https://<production-domain>/api/auth/callback` |
| Secret location | None | Developer's `.env.local` | Vercel Production environment |
| Migrations | `npm run test:db` on every change | Applied first and validated | Applied only after dev validation |

Decided on 2026-09-25: every tier uses one Yahoo app, `PikachuBball` (`VZxFFbzH`). Each Supabase project (and the local stack) holds one `custom:yahoo` provider configured with that app's client ID and secret, and the app lists each tier's Supabase callback as a redirect URI. Tiers keep separate Supabase projects, users, databases and stored tokens, but share Yahoo's rate limits and revocation. Since CAR-81, one sign-in covers Fantasy access: the provider requests `fspt-r` and the sign-in callback stores the Yahoo tokens from the Supabase session. The server refreshes them with the same app. Verified live on 2026-09-24: the Supabase-issued token reads Fantasy data, refresh returns 200 and rotates the token, and the Yahoo `sub` is the same across Yahoo apps. Only `VZxFFbzH` has Fantasy access; `si6rpgJq` (`PikachuBball - Dev`) and `rVqtn8Pt` (`Fantasy`) return 403, so every tier uses `VZxFFbzH`. Verified from the `client_id` in the production redirects on 2026-09-22 and 2026-09-23: production signs in through `PikachuBball - Local` (`i19hJ8X4`) and requests Fantasy access through `PikachuBball` (`VZxFFbzH`). Do not remove `VZxFFbzH`'s `/api/auth/yahoo/fantasy/callback`; doing so breaks Fantasy access for every league member.

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

## Provisioning checklist

- [ ] Sign in to the owner's Vercel account and record the Card Benefits project ID
  before creating the separate basketball project.
- [ ] Verify eligible Vercel capacity and create/link only `sfan0704/pikachubball`.
- [ ] Sign in to the owner's Supabase account and verify free project capacity.
- [ ] Create one basketball Supabase project in `us-east-1`; record its project ref
  and confirm it differs from `atgnooivdbdrihxwfelf` and `mhppghkxnalfoispkija`.
- [ ] Record the stable Vercel production alias and use its exact Yahoo callback.
- [ ] Confirm basketball production secrets exist only in the Vercel production
  environment and previews have no production credentials.
- [ ] Verify Vercel and Supabase metadata/health without inspecting private rows.
- [x] Confirm the legacy Replit configuration and data categories are preserved.
- [x] Confirm no legacy import, deletion, paid purchase, or Card Benefits change was
  performed during inventory.

Provisioning remains incomplete until the account checks above are performed. If
free capacity is unavailable, record that precise blocker; do not purchase a plan
or delete another project.
