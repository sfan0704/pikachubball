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

## Local setup

Install the pinned toolchain and dependencies:

```text
nvm use
npm ci
```

Create `.env.local` with synthetic or dedicated development values:

```text
NODE_ENV=development
APP_ORIGIN=http://localhost:5000
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=<local-publishable-key>
ENCRYPTION_KEY=<64-hex-character-key>
YAHOO_CLIENT_ID=<development-Yahoo-client-id>
YAHOO_CLIENT_SECRET=<development-Yahoo-client-secret>
YAHOO_PROVIDER_REDIRECT_URI=<callback-URL-displayed-by-Supabase>
```

Start the app with `npm run dev`. The default origin is `http://localhost:5000`.

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
