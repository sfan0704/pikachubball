# Pikachu Basketball

Pikachu Basketball is a small Yahoo Fantasy Basketball analysis app for 9-category leagues. It keeps the original Vite, React, Express, service, parser, and repository structure and runs on Vercel with a dedicated Supabase project.

The retained product includes league and week selection, rankings, team matchup comparison, roster data, and the matchup simulator. Yahoo is the only sign-in method. Chat and schedule features are outside the deployed product.

## Runtime

- Node.js 24 and npm 11
- Vite and React client
- Express API exported as a Vercel function
- Supabase Auth with a custom Yahoo OIDC provider
- Supabase Data API with owner-scoped RLS
- Yahoo Fantasy Sports API with read-only `fspt-r` access

Vercel serves the client and API on one origin. The expected traffic is small, including at most 14 concurrent league members, so the app does not require background workers, a cache cluster, or a dedicated database connection pool.

## Environments

The supported development path is the disposable stack and Yahoo stand-in, on a laptop or a remote worker with Docker. Hosted dev and the release branch model are still being activated; the [inventory](docs/reference/infrastructure-inventory.md#environment-tiers) records dated evidence.

| Environment | Current behavior | Authentication and credentials |
| --- | --- | --- |
| Local / CI | Disposable Supabase, recorded Yahoo responses, synthetic managers | No hosted credentials or real Yahoo calls |
| Preview | Feature-branch build check only | No Supabase/Yahoo credentials or sign-in |
| Dev | Dedicated Supabase project; local HTTPS client remains an owner-only exception while hosted `main` is pending (CAR-94) | Real Yahoo via `PikachuBball`; dev values only |
| Prod | Vercel production alias still follows `main` in the latest verified CAR-94 evidence | Production Supabase and Vercel Production variables |

The desired model is hosted `main` → dev and an approved release → `production` → prod. A `production` branch exists, but that alone does not activate the model. CAR-83 verified a manual dev migration on 2026-10-11; automatic releases remain disabled. Do not switch deployment branches before completing those issues.

One Yahoo sign-in does everything in hosted environments: Supabase's `custom:yahoo` provider requests Fantasy read scope (`fspt-r`), and `/api/auth/callback` stores the session's Yahoo tokens and syncs leagues. Dev and prod share the Fantasy-enabled Yahoo app, `PikachuBball`, including its secret, rate limits and revocation. Their databases, users, tokens and encryption keys remain separate. Local/CI uses the stand-in and synthetic login instead of a Yahoo provider.

Token refresh sends `YAHOO_PROVIDER_REDIRECT_URI`; keep its registered HTTPS redirect even though no route is served there. Yahoo requires HTTPS redirects. See the [remote development contract](docs/remote-development.md) before starting a task.

## Local setup

Install the pinned toolchain and dependencies:

```text
nvm use
npm ci
```

### Everyday development

`npm run dev` runs the whole app on your laptop with no hosted credentials and no network access to Yahoo. It needs Docker. It starts a throwaway Supabase stack, applies the migrations, starts the Yahoo stand-in (recorded, scrubbed responses played through the app's real transport) and seeds two synthetic managers in the recorded league, then starts the app on `http://localhost:5000` (set `PORT` to change it). Sign in as a manager with `http://localhost:5000/api/dev/login?user=a` (or `user=b`).

The stand-in can fail the way Yahoo does. Tell it with `curl -X POST http://127.0.0.1:5090/__scenario -d '{"scenario":"rate-limit","times":2}'`; scenarios are `ok`, `rate-limit`, `unavailable`, `unauthorized` (an expired token) and `timeout`, and `times` limits how many requests are affected. Local mode (`LOCAL_STACK=true`) refuses production, a hosted Supabase project and a hosted Yahoo address, and `YAHOO_API_BASE_URL` / `YAHOO_OAUTH_BASE_URL` cannot be set outside it.

Before a release, `npm run build && npm run load` simulates 14 managers using the app at once against the stand-in and reports league-view timings against the 2-second target and the Yahoo calls each step made (1 for a new scope, 0 for repeat views and comparisons).

### Owner-only local HTTPS exception

This is a temporary manual path for the owner to validate real Yahoo sign-in while CAR-94 is unfinished. It is not the remote worker bootstrap and must not be used by tests or automation. To use it (`npm run dev:hosted`), create `.env.local` from the template and fill in the dev values:

```text
cp .env.example .env.local
openssl rand -hex 32   # use as ENCRYPTION_KEY
```

The Supabase URL and publishable key come from the dev project's API settings. The Yahoo client ID and secret come from the Fantasy-enabled `PikachuBball` Yahoo app shared with production. Never copy production values into `.env.local`.

Create the local HTTPS certificate once. `mkcert -install` adds mkcert's local certificate authority to your system trust store (it asks for your password); the certificate files stay in the gitignored `.certs/` directory:

```text
brew install mkcert
mkcert -install
mkcert -cert-file .certs/localhost.pem -key-file .certs/localhost-key.pem localhost 127.0.0.1 ::1
```

Start the app with `npm run dev:hosted` and open `https://localhost:5001`. When `DEV_HTTPS_CERT` and `DEV_HTTPS_KEY` are set, the dev server serves HTTPS; it refuses those variables in production. It uses port 5001 because macOS AirPlay Receiver listens on 5000; without `PORT`, the server defaults to 5000.

## Checks

```text
npm run lint
npm run check
npm test
npm run build
npm run test:db
```

`npm run test:db` is the local database tier. It rebuilds a disposable Supabase database from `supabase/migrations` and runs the pgTAP owner-isolation suite in `supabase/tests`. It needs a running Docker engine (for example `brew install colima docker` then `colima start`) and uses the Supabase CLI pinned in `devDependencies`. Every CLI call targets the local stack, so it never reads hosted credentials or touches a hosted project. CI runs the same command.

The production build creates the client assets and the local Node server bundle. Vercel uses `api/index.ts` as the Express function and builds client assets into `public/` according to `vercel.json`.

## Supabase

The migration in `supabase/migrations` creates only the minimum hosted records: an encrypted Yahoo connection and owned league/team memberships. It uses foreign keys to `auth.users`, forced RLS, and authenticated security-invoker functions. The web runtime uses the publishable key and the signed-in user's session. It does not use a service-role key or database password.

For configuration and verification, see:

- [Runbooks](docs/runbooks/README.md): sign-in setup, secret exposure, key rotation, restore and rollback, season rollover
- [Yahoo authentication](docs/reference/authentication.md)
- [Owner-scoped storage](docs/reference/storage.md)
- [Infrastructure inventory](docs/reference/infrastructure-inventory.md)

## Architecture and contributing

- [Target state](docs/target-state.md): the agreed architecture the code follows, with its [changelog](docs/target-state-changelog.md).
- [AGENTS.md](AGENTS.md): the rules for every contribution, by people or coding agents.
