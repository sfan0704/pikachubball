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

The app has three separated tiers. Each tier has its own Supabase project (or local stack), users, database and stored tokens. All three sign in through the same Yahoo app, `PikachuBball`, which lists every tier's Supabase callback.

| Tier | Runs at | Supabase | Yahoo app | Credentials live in | Used for |
| --- | --- | --- | --- | --- | --- |
| Local | laptop and CI | disposable local stack (`npm run test:db`) | `PikachuBball` (planned; see below) | nothing hosted | migrations and RLS tests |
| Dev | `https://localhost:5001` | `Pikachu Basketball Development` | `PikachuBball` | `.env.local` | live Yahoo sign-in and data; validating migrations before production |
| Prod | Vercel production alias | `Pikachu Basketball` | `PikachuBball` (switching from `PikachuBball - Local`, CAR-57) | Vercel Production environment only | league members |

Yahoo is used once per sign-in: Supabase's `custom:yahoo` provider requests `openid profile email fspt-r`, and the sign-in callback stores the Yahoo tokens that Supabase hands over (encrypted, owner-scoped). The server refreshes them with the same app's `YAHOO_CLIENT_ID`/`YAHOO_CLIENT_SECRET`, because a Yahoo refresh token only works with the app that issued it. Yahoo only grants Fantasy data to apps it has activated, and newly created apps return `403 This application is not authorized`. So every tier uses the activated `PikachuBball` app: each tier's Supabase `custom:yahoo` provider and server hold that app's client ID and secret, and the app lists each tier's Supabase callback as a redirect URI. Vercel preview deployments receive no Supabase or Yahoo credentials. Project identifiers are recorded in the [infrastructure inventory](docs/INFRASTRUCTURE_INVENTORY.md#environment-tiers).

## Local setup

Install the pinned toolchain and dependencies:

```text
nvm use
npm ci
```

To run the app against the dev tier, create `.env.local` from the template and fill in the dev values:

```text
cp .env.example .env.local
openssl rand -hex 32   # use as ENCRYPTION_KEY
```

The Supabase URL and publishable key come from the dev project's API settings. The Yahoo client ID and secret come from the `PikachuBball` Yahoo app, the same one the dev Supabase provider uses. Never copy production values into `.env.local`.

Optionally, serve local dev over HTTPS. Create the certificate once. `mkcert -install` adds mkcert's local certificate authority to your system trust store (it asks for your password); the certificate files stay in the gitignored `.certs/` directory:

```text
brew install mkcert
mkcert -install
mkcert -cert-file .certs/localhost.pem -key-file .certs/localhost-key.pem localhost 127.0.0.1 ::1
```

Start the app with `npm run dev` and open `https://localhost:5001`. When `DEV_HTTPS_CERT` and `DEV_HTTPS_KEY` are set, the dev server serves HTTPS; it refuses those variables in production. It uses port 5001 because macOS AirPlay Receiver listens on 5000; without `PORT`, the server defaults to 5000.

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

- [Yahoo authentication](docs/SUPABASE_YAHOO_AUTH.md)
- [Owner-scoped storage](docs/SUPABASE_STORAGE.md)
- [Retained product contract](docs/RETAINED_PRODUCT_CONTRACT.md)
- [Infrastructure inventory](docs/INFRASTRUCTURE_INVENTORY.md)

## Architecture

HTTP controllers remain thin. Yahoo integration lives in services, response parsing stays in parser modules, shared response contracts stay in `shared/schema.ts`, and persistence stays behind the owner-scoped repository interfaces in `server/storage/`. This preserves the useful boundaries in the original app while removing the legacy Replit, Passport, chat, schedule, and direct PostgreSQL runtime paths.
