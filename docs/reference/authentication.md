# Supabase Yahoo authentication

The deployed application has one sign-in method: Yahoo through a Supabase custom OIDC provider. Express owns the browser endpoints and Supabase owns the PKCE session. Passport, local usernames, and passwords are not part of the deployed request path.

## Production boundary

- The browser starts at `GET /api/auth/yahoo`.
- Supabase uses the provider id `custom:yahoo` and returns to the exact application URL `https://<production-domain>/api/auth/callback`.
- The callback exchanges the one-time PKCE code on the server.
- The server accepts identities only when their provider is `custom:yahoo` and their issuer is `https://api.login.yahoo.com`.
- Supabase session cookies are `HttpOnly`, `Secure` in production, `SameSite=Lax`, and scoped to `/`.
- Yahoo access and refresh tokens are handed once to the token repository under the Supabase user UUID. They are never returned in an API response or placed in a redirect URL, and are stored encrypted (see [storage](storage.md)).
- Authentication responses disable browser and intermediary caching.

Provider, Yahoo app and environment-variable setup is in the [Yahoo sign-in provider runbook](../runbooks/yahoo-sign-in-provider.md).

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
