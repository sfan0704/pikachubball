# Yahoo fixture capture

Use it when the recorded Yahoo responses need creating or refreshing: before work that parses a Yahoo call for the first time, and once each season.

## Do

1. Have the dev Yahoo app's client ID and secret to hand (from the Yahoo developer console, not from a file in the repo).
2. Find a league key for a league you belong to, such as `466.l.12345`. A finished league from last season is worth capturing too.
3. Run, in your own terminal:

   ```text
   YAHOO_CLIENT_ID=... YAHOO_CLIENT_SECRET=... npm run capture:yahoo -- <league_key> 1
   ```

   Open the link it prints, approve, and paste the code. If Yahoo refuses `oob`, set `YAHOO_ACCESS_TOKEN` to an access token instead.
4. The script writes scrubbed responses to `tests/backend/fixtures/yahoo/captured/`: the user's teams, the season standings, the current week and the given week.

## Check

- Search the captured files for your Yahoo nickname, team names, league name and email. None should appear.
- Commit the files in a pull request for the issue that needs them.

The script only makes read-only GET calls, and never writes or prints the token.
