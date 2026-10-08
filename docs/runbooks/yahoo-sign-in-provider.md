# Yahoo sign-in provider setup

Each environment (local, dev, prod) has its own Supabase project and exactly one `custom:yahoo` provider. Yahoo is used twice on every sign-in: the provider signs the user in, then the app runs its own Fantasy access OAuth with the server's `YAHOO_CLIENT_ID`. See the [infrastructure inventory](../reference/infrastructure-inventory.md#environment-tiers) for which Yahoo app each tier uses.

## 1. Create the provider in Supabase

In the environment's Supabase project, create one custom OAuth/OIDC provider:

| Setting | Value |
| --- | --- |
| Provider name | `yahoo` |
| Type | OIDC |
| Issuer URL | `https://api.login.yahoo.com` |
| Scopes | `openid profile email fspt-r` |
| PKCE | Enabled |
| Nonce verification | Enabled |

The client ID and secret are the Yahoo app's for that tier.

## 2. Register the redirect URIs in the Yahoo app

Yahoo accepts only `https://` redirect URIs. Register exactly:

- the Supabase callback shown for the provider (`https://<project-ref>.supabase.co/auth/v1/callback`), and
- the app's Fantasy access callback (`<APP_ORIGIN>/api/auth/yahoo/fantasy/callback`).

Never remove the Fantasy callback of the shared app: that breaks Fantasy access for every league member. Local dev serves HTTPS with a mkcert certificate (see the README).

## 3. Set the Supabase URL configuration

Site URL: the environment's `APP_ORIGIN`. Allowed redirect: exactly `<APP_ORIGIN>/api/auth/callback`. Do not allow Vercel preview domains on the production project.

## 4. Set the server variables

Prod and dev values live in the environment's Vercel scope (or in `.env.local` for local). Credentials of one tier never go into another.

```text
NODE_ENV=production
APP_ORIGIN=https://<origin>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<project-publishable-key>
ENCRYPTION_KEY=<64 hex characters>
YAHOO_CLIENT_ID=<Yahoo-app-client-id>
YAHOO_CLIENT_SECRET=<Yahoo-app-client-secret>
YAHOO_PROVIDER_REDIRECT_URI=<APP_ORIGIN>/api/auth/yahoo/fantasy/callback
```

The runtime never receives a Supabase service-role key or a database password. Nothing here uses a `VITE_` prefix.

## 5. Check it

Follow the [verification checkpoint](../reference/authentication.md#verification-checkpoint) in a browser. It confirms sign-in, the callback, `/api/auth/me`, a protected route, sign-out and the two callback failure cases.
