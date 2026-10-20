# Yahoo secret exposure

Use this when the Yahoo client secret was committed, logged, pasted into chat or an issue, or otherwise seen by someone who should not have it.

Only production holds it: in Vercel's Production scope and the Supabase sign-in provider, plus the owner's password manager.

1. **Regenerate the secret** in the Yahoo Developer console for the affected app. The old secret stops working immediately; sign-in and token refresh fail until the steps below finish.
2. **Update production.** In Vercel, set `YAHOO_CLIENT_SECRET` in the Production scope. In Supabase (prod project), edit the `yahoo` custom provider and paste the new secret. If you keep a copy in a local `.env.local` for fixture capture, update it too.
3. **Redeploy** production so the functions pick up the variable.
4. **Check:** follow the [verification checkpoint](../reference/authentication.md#verification-checkpoint) on production. A token refresh also exercises the secret; a user whose access token has expired is a good test.
5. **Clean up the leak.** Remove the secret from wherever it appeared. If it reached git history, treat history as public and rely on the regeneration in step 1. Add a line to the incident notes in Linear (no secret values).

Stored user tokens are not affected by this procedure. If the encryption key was exposed too, run [encryption key rotation](encryption-key-rotation.md).
