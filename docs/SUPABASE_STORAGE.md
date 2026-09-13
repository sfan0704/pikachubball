# Owner-scoped Supabase storage

The hosted app uses the signed-in user's Supabase client for retained persistence. The web runtime receives a publishable key and the user's HttpOnly session cookies. It does not receive a service-role key or a database password.

## Repository boundary

`SupabaseOwnerStorage` implements the retained Yahoo token repository seam for one authenticated Supabase UUID. Express creates it only after Supabase verifies the request. Every method rejects a different user id before making a Data API request, and Postgres RLS independently enforces `auth.uid() = owner_id`.

The repository stores:

- one `yahoo_connections` row per authenticated owner;
- the stable Yahoo provider subject and minimal display metadata;
- an AES-256-GCM ciphertext for each Yahoo access and refresh token;
- an encryption key version and monotonically increasing token version; and
- current `fantasy_memberships` pairs used to reject forged league and team keys before a Yahoo request.

Token ciphertext is bound to the owner UUID, token purpose, and key version as authenticated data. Copying it to another owner, swapping access and refresh values, changing the ciphertext, or using another key fails authentication. The database never receives plaintext provider tokens.

`rotate_yahoo_tokens` compares the version read by the caller with the current row and increments it in the same update. When two refreshes race, only the first matching version commits. A stale result fails and cannot overwrite the newer credentials.

## Versioned migration

Apply [`202609120001_owner_scoped_connections.sql`](../supabase/migrations/202609120001_owner_scoped_connections.sql) to an empty dedicated Supabase project. The migration creates the two retained tables, foreign keys to `auth.users`, forced RLS, explicit authenticated policies, and security-invoker RPCs. It does not alter or drop any legacy table, so importing or retaining the old schema is non-destructive.

Run the RLS matrix against a disposable local Supabase instance:

```text
supabase db reset
supabase test db supabase/tests/owner_scoped_storage_test.sql
```

The matrix creates synthetic owners A and B, checks owner reads and writes, rejects anonymous and cross-owner operations, and proves the compare-and-swap refresh rule. Do not use real user rows in reset or migration tests.

## Request flow

1. Supabase verifies the browser session and produces the owner UUID.
2. Express attaches a request-scoped repository using that same Supabase client.
3. The Yahoo callback encrypts provider tokens and upserts the owner's connection through a security-invoker RPC.
4. League discovery replaces the owner's allowed league/team pairs in one database transaction.
5. Roster, rankings, matchup, and visualization routes verify the exact pair before requesting data from Yahoo.
6. Token refresh writes only when its expected version is still current.

The repository unit tests use synthetic credentials and inspect only ciphertext shape and sanitized call parameters. Live Supabase verification remains part of CAR-60's deployment checkpoint.
