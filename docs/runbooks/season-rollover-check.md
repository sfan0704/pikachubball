# Season rollover check

Yahoo opens a new fantasy season each autumn with new league keys. The app picks them up from the user's league list; nothing is configured per season. Run this check when the new season opens, on dev first.

1. Sign in with the owner's account and open the league picker.
2. Confirm the new season's leagues are listed and the previous season's leagues show as finished (or are gone).
3. Open a new-season league and check that its standings and matchup load.
4. In the Supabase SQL editor, confirm the stored pairs match what the picker shows:
   ```sql
   select league_key, team_key from public.fantasy_memberships order by league_key;
   ```
   A league Yahoo no longer lists must not remain.
5. Re-check the Yahoo app registration from the [infrastructure inventory](../reference/infrastructure-inventory.md): app IDs, redirect URIs and scopes still match, and the app still has Fantasy read access.

If a new league is missing, sign out and back in (this re-fetches the list). If the list is still wrong, check the Vercel logs for `YAHOO_*` errors on the request.
