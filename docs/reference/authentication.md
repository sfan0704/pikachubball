# Supabase Yahoo authentication

The deployed application has one sign-in method: Yahoo through a Supabase custom OIDC provider. Express owns the browser endpoints and Supabase owns the PKCE session. Passport, local usernames, and passwords are not part of the deployed request path.

## Production boundary

- The browser starts at `GET /api/auth/yahoo`.
- Supabase uses the provider id `custom:yahoo` and returns to the exact application URL `https://<production-domain>/api/auth/callback`.
- The callback exchanges the one-time PKCE code on the server.
- If identity validation or the Yahoo token handoff fails after exchange, the response discards the SDK's newly issued session cookies and clears existing app session chunks. A rejected callback cannot leave the browser authenticated. PKCE cleanup and unrelated cookies are retained.
- The server accepts identities only when their provider is `custom:yahoo` and their issuer is `https://api.login.yahoo.com`.
- Supabase session cookies are `HttpOnly`, `Secure` in production, `SameSite=Lax`, and scoped to `/`.
- Yahoo access and refresh tokens are handed once to the token repository under the Supabase user UUID. They are never returned in an API response or placed in a redirect URL, and are stored encrypted (see [storage](storage.md)).
- Authentication responses disable browser and intermediary caching.

Provider, Yahoo app and environment-variable setup is in the [Yahoo sign-in provider runbook](../runbooks/yahoo-sign-in-provider.md).

## Verification checkpoint

Before enabling users, verify all of the following in the production browser:

1. A signed-out visit shows only **Continue with Yahoo**.
2. Sign-in leaves the application for Supabase and Yahoo, then returns to `/api/auth/callback` and redirects to `/`.
3. `GET /api/me` returns the Supabase UUID, Yahoo connection state and saved choices without any provider token.
4. A protected basketball endpoint accepts the authenticated request.
5. Signing out clears the local Supabase session and the next protected request returns `401`.
6. Reusing a completed callback code returns `401` and does not create a second token record.
7. A callback without both Yahoo provider tokens returns `401` and creates no token record.

The repository tests cover the provider, issuer, callback, cookie, replay, token-handoff, and signed-out boundaries. The Express/real SSR SDK integration suite uses two independent cookie jars and a synthetic Auth transport to verify PKCE context isolation, one-time codes, fresh-instance cookie reuse and rejected-handoff cleanup. This proves the app/SDK boundary; it does not test Supabase's own OIDC signature/nonce enforcement or replace the live owner/browser checkpoint.

Signing out clears the browser's session and revokes refresh access through Supabase. Every protected request also calls `is_current_session_active()` with the request's user-scoped client. The no-argument RPC checks that the signed JWT's `session_id` exists in `auth.sessions` and belongs to `auth.uid()`, so a copied pre-logout cookie is rejected on the next protected request even while its access JWT remains unexpired. Missing, malformed, revoked or unavailable session checks fail closed. The RPC returns one boolean; it exposes no session rows and accepts no user-supplied identifiers. See [Supabase sessions](https://supabase.com/docs/guides/auth/sessions#how-to-ensure-an-access-token-jwt-cannot-be-used-after-a-user-signs-out).

The baseline migration defines `public.is_current_session_active()`; deploying code that requires the RPC to a database without it denies authenticated requests. Run `npm run test:db` for the real local Auth/PostgREST logout replay and SQL caller-isolation tests. Synthetic SDK tests cover cold-app cookie replay without contacting Yahoo. Owner verification of hosted logout remains a release acceptance step.
