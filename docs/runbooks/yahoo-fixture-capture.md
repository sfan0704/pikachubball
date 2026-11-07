# Yahoo fixture capture

Use it when the recorded Yahoo responses need creating or refreshing: before work that parses a Yahoo call for the first time, and once each season.

## Do

1. Run `npm run capture:yahoo` in your own terminal. It takes the `PikachuBball` Yahoo app's `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET` from your shell's environment (or a `.env.local` you keep only on your machine).
2. Approve access in the browser window it opens, and paste the code Yahoo shows into the terminal. If Yahoo refuses the `oob` sign-in, set `YAHOO_ACCESS_TOKEN` to an access token and run it again.
3. It finds your NBA leagues and records the newest league and, if there is one, last season's league: for each, the season standings, current week and week 1, plus your lists of teams and leagues. To record a particular league instead, pass its key: `npm run capture:yahoo -- 466.l.12345`.
4. The scrubbed files go to `tests/backend/fixtures/yahoo/captured/`, replacing any earlier capture. If a removed name, identifier or email still appears anywhere in the output, the script stops and writes nothing.

## Record a finished matchup week

For research that checks weekly numbers against Yahoo's official totals (FAN-91), run `npm run capture:yahoo-week` the same way. It records, for your newest league and the last finished week (or `npm run capture:yahoo-week -- 478.l.12345 2` for league `478.l.12345`, week 2):

- the current and chosen week's scoreboard, Yahoo's game weeks and the league's transactions;
- for your team and that week's opponent: week totals, the roster with week stats, each day's roster with that day's stats, each day's team totals, and the team's adds and drops;
- for players who joined or left either roster during the week: their stats for each day and the week.

That's about 45 read-only calls. A call Yahoo refuses doesn't stop the capture: `probes.json` lists every call with `ok` or Yahoo's status. Files go to `tests/backend/fixtures/yahoo/captured-week/`, replacing any earlier week capture. Pick a week where both teams benched someone and made a midweek add or drop, if there is one.

## Check

- Skim the captured files for your Yahoo nickname, team names, league name and email. The script already checks for these, so none should appear.
- Commit the files in a pull request for the issue that needs them.

The scripts only make read-only GET calls, and never write or print the token.
