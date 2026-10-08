# Encryption key rotation

Stored Yahoo tokens are encrypted with `ENCRYPTION_KEY`. Each row records the key version it was written with. Rotation raises the version by one: the old key becomes `ENCRYPTION_KEY_PREVIOUS`, new writes use the new key, and each token moves to the new key at its next refresh. Only the current key and the one before it are held at a time.

Use it on a schedule, and immediately if a key may have leaked.

## Rotate

1. Generate a new key: `openssl rand -hex 32`.
2. In the environment's Vercel scope, set
   - `ENCRYPTION_KEY_PREVIOUS` = the current `ENCRYPTION_KEY`,
   - `ENCRYPTION_KEY` = the new key,
   - `ENCRYPTION_KEY_VERSION` = the current version plus one (it is `1` when unset).
3. Redeploy. The app refuses to start if `ENCRYPTION_KEY_PREVIOUS` is set while the version is below 2.
4. Check that old tokens still work: sign in as an existing user and open a league.

## Finish

Tokens refresh about hourly while a user is active, but a user who has not visited keeps an old row. Count rows by version in the Supabase SQL editor:

```sql
select encryption_key_version, count(*) from public.yahoo_connections group by 1 order by 1;
```

When no row uses the previous version (or the remaining users are willing to sign in again), remove `ENCRYPTION_KEY_PREVIOUS` and redeploy. A row still on the removed version is unreadable: that user signs in again and a fresh token is stored.

## If a key leaked

Rotate as above, then also end the exposure of the tokens themselves: affected users' Yahoo tokens can be revoked by deleting their connection (the user signs in again), and the Yahoo secret may need regenerating ([Yahoo secret exposure](yahoo-secret-exposure.md)).
