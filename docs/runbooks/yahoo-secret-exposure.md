# Yahoo secret exposure

Use this when a Yahoo client secret (any tier) was committed, logged, pasted into chat or an issue, or otherwise seen by someone who should not have it.

Dev and prod can share a Yahoo app, so a leaked secret affects every tier that uses that app. Treat the app as exposed, not just one environment.

1. **Regenerate the secret** in the Yahoo Developer console for the affected app. The old secret stops working immediately; sign-in and token refresh fail until the steps below finish.
2. **Update prod first.** In Vercel, set `YAHOO_CLIENT_SECRET` in the Production scope. In Supabase (prod project), edit the `yahoo` custom provider and paste the new secret.
3. **Update dev.** Set `YAHOO_CLIENT_SECRET` in the dev Vercel scope and in the dev Supabase provider. Developers update `.env.local`.
4. **Redeploy** prod (and dev) so the functions pick up the variable.
5. **Check:** follow the [verification checkpoint](../reference/authentication.md#verification-checkpoint) on prod, then dev. A token refresh also exercises the secret; a user whose access token has expired is a good test.
6. **Clean up the leak.** Remove the secret from wherever it appeared. If it reached git history, treat history as public and rely on the regeneration in step 1. Add a line to the incident notes in Linear (no secret values).

Stored user tokens are not affected by this procedure. If the encryption key was exposed too, run [encryption key rotation](encryption-key-rotation.md).
