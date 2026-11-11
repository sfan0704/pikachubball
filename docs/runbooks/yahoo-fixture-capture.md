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

That's about 45 read-only calls. A call Yahoo refuses doesn't stop the capture: `probes.json` lists every call with `ok` or Yahoo's status. Files go to `yahoo-research/week-<n>/`, replacing any earlier capture of that week. Like the research capture, it's gitignored and checked with the same leak check, which lets public NBA names through: zip it and attach it in the project chat instead of committing it. Pick a week where both teams benched someone and made a midweek add or drop, if there is one.

## Record everything the daily-stats research needs

The daily-stats research tickets (FAN-91 to FAN-96) need live Yahoo answers that a cloud session can't get. One command records all of their API calls in one sign-in, and each ticket's folder lists the website pages to save by hand.

1. Run `npm run capture:yahoo-research` and sign in as above. It uses your newest NBA league and your team in it; pass a league key to choose another (`npm run capture:yahoo-research -- 466.l.12345`). It picks three sample players from yesterday's roster (a healthy one, an injured one if there is one, and one more); to choose them, add `--players=466.p.1,466.p.2,466.p.3`.
2. It makes about 100 read-only calls and takes a few minutes. A call Yahoo refuses doesn't stop it: some research calls are expected to fail (for example projected stats, FAN-94), and the status and Yahoo's answer are recorded either way. Run it while an NBA game is live if you can: FAN-92 wants a live roster.
3. The output goes to `yahoo-research/`, one folder per ticket, replacing any earlier run. Each folder has a `README.md` listing every call with its HTTP status and file, and each file holds the request, the status and the scrubbed response. FAN-91's folder has the finished-week capture (the same files as `capture:yahoo-week`, with `probes.json` as its index).
4. Do the browser checklist in the `README.md` of FAN-92, FAN-93, FAN-94 and FAN-95, saving each page into that folder's `browser/` folder under the name the checklist gives. The URLs are already filled in for your league. For a HAR: in Chrome, open DevTools → Network, tick Preserve log, load the page, then right-click the request list → Export HAR (sanitized), which leaves out cookies and sign-in headers.
5. Zip the `yahoo-research` folder and attach it in the project chat. Don't commit it: `.gitignore` keeps it out, because the website pages hold your league's names and the repository is public.

## Record live game logs (FAN-92)

Yahoo's player game log carries the NBA schedule and game state. To see how it shows a live game, run `npm run capture:yahoo-game-log` while NBA games are live, signing in as above. It reads the game logs of your league's rostered players (two calls of 25 players), waits 2 minutes and reads them again (`--rounds=<n>` and `--minutes=<n>` change that; pass a league key to choose another league). Run it once more on a Monday to see how far ahead the log reaches. The files go to `yahoo-research/FAN-92-game-log/`, with a `README.md` listing each call's time and status, checked with the same leak check as the research capture. Zip the folder and attach it to FAN-92; don't commit it.

## Record the daily-stats game-log and transactions calls (FAN-102)

`npm run capture:yahoo-live-calls` records, scrubbed, the two daily-stats calls parsers are tested against: game logs for 25 players by key (D3) and adds, drops and trades for one team (D7) in your newest league (pass a league key to choose another). Sign in as above, and run it while NBA games are live: it reads the rostered players' game logs first and puts players with a live game into the 25. For D7 it records the first team in the transactions feed that made a trade, and your own team; it stops if nobody has traded. The files go to `tests/backend/fixtures/yahoo/daily-stats/`, replacing any earlier capture, with a `README.md` giving each call's time, status and what came back. They're checked with the same leak check as the research capture (public NBA names pass) and are committed.

## Check

- Skim the captured files (fixtures only; the research folder is shared privately) for your Yahoo nickname, team names, league name and email. The script already checks for these, so none should appear.
- Commit the files in a pull request for the issue that needs them.

The scripts only make read-only GET calls, and never write or print the token.
