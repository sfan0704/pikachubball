# Supabase Yahoo authentication

The deployed application has one sign-in method: Yahoo through a Supabase custom OIDC provider. Express owns the browser endpoints and Supabase owns the PKCE session. Passport, local usernames, and passwords are not part of the deployed request path.

## Production boundary

- The browser starts at `GET /api/auth/yahoo`.
- Supabase uses the provider id `custom:yahoo` and returns to the exact application URL `https://<production-domain>/api/auth/callback`.
- The callback exchanges the one-time PKCE code on the server.
- The server accepts identities only when their provider is `custom:yahoo` and their issuer is `https://api.login.yahoo.com`.
- Supabase session cookies are `HttpOnly`, `Secure` in production, `SameSite=Lax`, and scoped to `/`.
- Yahoo access and refresh tokens are handed once to the token repository under the Supabase user UUID. They are never returned in an API response or placed in a redirect URL. CAR-60 adds owner-bound encryption to persistence before production is enabled.
- Authentication responses disable browser and intermediary caching.

## Supabase custom provider

Create one custom OAuth/OIDC provider in the dedicated basketball Supabase project with these values:

| Setting | Value |
| --- | --- |
| Provider name | `yahoo` |
| Type | OIDC |
| Issuer URL | `https://api.login.yahoo.com` |
| Scopes | `openid profile email fspt-r` |
| PKCE | Enabled |
| Nonce verification | Enabled |

Use the callback URL displayed by Supabase for this provider as the callback in the Yahoo Developer application. Configure the same Yahoo application credentials in the server-only Vercel environment because Yahoo requires them when the API access token is refreshed. They must never use a `VITE_` prefix or enter a client bundle.

To set an existing project's provider credentials without the dashboard, run `npm run yahoo:provider -- prod` (or `dev`). It reads `YAHOO_CLIENT_ID`/`YAHOO_CLIENT_SECRET` from the environment or `.env.local`, refuses any app other than `PikachuBball` (`VZxFFbzH`), prompts for the project's secret key, updates `custom:yahoo` through the Auth admin API, and waits until the sign-in redirect uses the new app. `npm run yahoo:provider -- prod --check` only reports which Yahoo app the project signs in through.

In Supabase URL configuration, set the site URL to the production Vercel origin and allow exactly:

```text
https://<production-domain>/api/auth/callback
```

Do not authorize Vercel preview domains against the production Yahoo application.

## Development tier

The dev tier mirrors production with its own Supabase project, `Pikachu Basketball Development`. Configure the same custom provider settings above in the dev project.

Every tier (local, dev and prod) uses the same Yahoo application, `PikachuBball` (`VZxFFbzH`), because Yahoo only serves Fantasy data to apps it has activated. Each Supabase provider and each server environment holds that application's client ID and secret, and the application registers each tier's Supabase callback:

```text
https://ocqdxmfpezxpgutoicyh.supabase.co/auth/v1/callback
https://fpdwtpwpmxsbgjxizuxa.supabase.co/auth/v1/callback
```

Sign-in stores the Yahoo tokens from the Supabase session; there is no second Yahoo authorization. `YAHOO_PROVIDER_REDIRECT_URI` is only sent as `redirect_uri` on token refresh. In the dev project's URL configuration, set the site URL to the local origin and allow its callback:

```text
https://localhost:5001/api/auth/callback
```

Developers keep dev values in `.env.local`, created from `.env.example`. Dev credentials never enter Vercel, and production credentials never enter `.env.local`.

## Vercel environment

Set these server-side variables for the production deployment:

```text
NODE_ENV=production
APP_ORIGIN=https://<production-domain>
SUPABASE_URL=https://<basketball-project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<project-publishable-key>
ENCRYPTION_KEY=<64-hex-character key>
YAHOO_CLIENT_ID=<Yahoo-application-client-id>
YAHOO_CLIENT_SECRET=<Yahoo-application-client-secret>
YAHOO_PROVIDER_REDIRECT_URI=https://<production-domain>/api/auth/yahoo/fantasy/callback  # sent as redirect_uri on refresh only
```

Storage configuration is defined by CAR-60. The final Vercel runtime must not receive a Supabase service-role key or database password.

`APP_ORIGIN` must be an HTTPS origin with no path, query, fragment, or embedded credentials. The same origin is used to construct the only accepted application callback.

## Verification checkpoint

Before enabling users, verify all of the following in the production browser:

1. A signed-out visit shows only **Continue with Yahoo**.
2. Sign-in leaves the application for Supabase and Yahoo, then returns to `/api/auth/callback` and redirects to `/`.
3. `GET /api/auth/me` returns the Supabase UUID and Yahoo profile projection without any provider token.
4. A protected basketball endpoint accepts the authenticated request.
5. Signing out clears the local Supabase session and the next protected request returns `401`.
6. Reusing a completed callback code returns `401` and does not create a second token record.
7. A callback without both Yahoo provider tokens returns `401` and creates no token record.

The repository tests cover the provider, issuer, callback, cookie, replay, token-handoff, and signed-out boundaries. The production pass confirms the external Yahoo and Supabase configuration matches those boundaries.

## References

- [Supabase custom OAuth/OIDC providers](https://supabase.com/docs/guides/auth/social-login/auth-custom-oauth)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side)
- [Yahoo OpenID Connect](https://developer.yahoo.com/oauth2/guide/openid_connect/)
