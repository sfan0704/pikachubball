# Yahoo sign-in provider setup

Production has its own Supabase project with exactly one `custom:yahoo` provider; local and CI use the Yahoo stand-in and synthetic sign-in instead. One Yahoo sign-in covers Fantasy access: the provider requests the `fspt-r` scope, and the app stores the Yahoo tokens Supabase returns. The server refreshes them with the same app's `YAHOO_CLIENT_ID` and secret. Production uses the Fantasy-enabled `PikachuBball` Yahoo app; see the [infrastructure inventory](../reference/infrastructure-inventory.md#environment-tiers).

## 1. Create the provider in Supabase

In the production Supabase project, create one custom OAuth/OIDC provider:

| Setting | Value |
| --- | --- |
| Provider name | `yahoo` |
| Type | OIDC |
| Issuer URL | `https://api.login.yahoo.com` |
| Scopes | `openid profile email fspt-r` |
| PKCE | Enabled |
| Nonce verification | Enabled |

The client ID and secret are the Yahoo app's.

## 2. Register the redirect URIs in the Yahoo app

Yahoo accepts only `https://` redirect URIs. Register exactly:

- the Supabase callback shown for the provider (`https://<project-ref>.supabase.co/auth/v1/callback`), and
- the redirect the server sends when it refreshes Yahoo tokens (`<APP_ORIGIN>/api/auth/yahoo/fantasy/callback`).

Nothing is served at that second path; Yahoo only checks that a refresh names a registered redirect. Never remove it from the app: token refresh would then fail for every league member.

## 3. Set the Supabase URL configuration

Site URL: production's `APP_ORIGIN`. Allowed redirect: exactly `<APP_ORIGIN>/api/auth/callback`. Do not allow Vercel preview domains on the production project.

## 4. Set the server variables

These live in Vercel's Production scope only. Previews and local work never receive them.

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
