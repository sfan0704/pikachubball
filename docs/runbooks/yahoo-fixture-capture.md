# Yahoo fixture capture

Use it when the recorded Yahoo responses need creating or refreshing: before work that parses a Yahoo call for the first time, and once each season.

## Do

1. Run `npm run capture:yahoo` in your own terminal. It takes the dev Yahoo app's `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET` from the environment or `.env.local`.
2. Approve access in the browser window it opens, and paste the code Yahoo shows into the terminal. If Yahoo refuses the `oob` sign-in, set `YAHOO_ACCESS_TOKEN` to an access token and run it again.
3. It finds your NBA leagues and records the newest league and, if there is one, last season's league: for each, the season standings, current week and week 1, plus your lists of teams and leagues. To record a particular league instead, pass its key: `npm run capture:yahoo -- 466.l.12345`.
4. The scrubbed files go to `tests/backend/fixtures/yahoo/captured/`, replacing any earlier capture. If a removed name, identifier or email still appears anywhere in the output, the script stops and writes nothing.

## Check

- Skim the captured files for your Yahoo nickname, team names, league name and email. The script already checks for these, so none should appear.
- Commit the files in a pull request for the issue that needs them.

The script only makes read-only GET calls, and never writes or prints the token.
