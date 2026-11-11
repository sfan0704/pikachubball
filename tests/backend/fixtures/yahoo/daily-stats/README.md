# Daily-stats call recordings

Recorded in league 478.l.14822 (D3 and D7 by `npm run capture:yahoo-live-calls`, FAN-102), scrubbed of team, manager and league names. Each file is Yahoo's response body.

## D3 game logs, 25 players by key

- File: `d3-game-logs-by-key.json`
- GET `/league/478.l.14822/players;player_keys=478.p.5432,478.p.5471,478.p.5836,478.p.5840,478.p.3704,478.p.4244,478.p.4472,478.p.4563,478.p.4612,478.p.4614,478.p.4622,478.p.4725,478.p.4840,478.p.4892,478.p.4896,478.p.5007,478.p.5012,478.p.5069,478.p.5161,478.p.5185,478.p.5197,478.p.5292,478.p.5294,478.p.5295,478.p.5318;out=game_log` (with `?format=json`)
- 2026-11-11T01:02:15.155Z: HTTP 200; asked 25 players, got 25; 4 with a live game; none missing

## D7 transactions, a team that traded

- File: `d7-transactions-trading-team.json`
- GET `/league/478.l.14822/transactions;types=add,drop,trade;team_key=478.l.14822.t.7` (with `?format=json`)
- 2026-11-11T01:02:15.642Z: HTTP 200; 18 transactions (add/drop 7, trade 5, add 4, drop 2); 0 without 478.l.14822.t.7

## D7 transactions, the signed-in team

- File: `d7-transactions-own-team.json`
- GET `/league/478.l.14822/transactions;types=add,drop,trade;team_key=478.l.14822.t.10` (with `?format=json`)
- 2026-11-11T01:02:15.792Z: HTTP 200; 10 transactions (add/drop 6, add 3, drop 1); 0 without 478.l.14822.t.10

## D1 week table, a finished week (FAN-91 capture)

- File: `d1-week-2-final.json`
- GET `/league/478.l.14822;out=settings/scoreboard;week=2` (with `?format=json`)
- Recorded 2026-11-08 by `npm run capture:yahoo-week`, after week 2 ended: every team has 0 remaining and 0 live; completed games run 39 to 45 (44 for t.10, 41 for t.9).

## D1 week table, the current week in progress (FAN-91 capture)

- File: `d1-week-3-midweek.json`
- GET `/league/478.l.14822;out=settings,scoreboard` (with `?format=json`)
- Recorded 2026-11-08 during week 3 with games live: each team's `team_remaining_games` has remaining, live and completed counts (t.10: 7, 1, 31).

## D4 player period totals, 3 players (FAN-93)

Recorded by the FAN-93 capture on 2026-11-07 (US Eastern), game context with no `/league` prefix. Each is the `response` of the capture's file of the same period. Yahoo sends field goals and free throws as attempts then makes (stat ids 3/4 and 6/7) here, not the league's combined stat.

- Files: `d4-players-season.json`, `d4-players-lastweek.json`, `d4-players-lastmonth.json`
- GET `/players;player_keys=478.p.10454,478.p.6417,478.p.6165/stats;type={season,lastweek,lastmonth}` (with `?format=json`)
- HTTP 200 each; GP season 9/8/9, last week 4/3/4, last month 9/8/9

## Acquisition recordings (FAN-96, used by FAN-115)

Recorded on 2026-11-07 by the FAN-98 research capture in the same league, already scrubbed. Each file is Yahoo's response body.

- `d8-draft-results.json`: GET `/league/478.l.14822/draftresults`; 182 auction picks.
- `d7-transactions-whole-league.json`: GET `/league/478.l.14822/transactions;types=add,drop,trade`; the whole season's 144 moves, one vetoed trade.
- `fan96-rostered-players.json`: not a Yahoo body. Each team's rostered player keys, taken from that capture's `/league/478.l.14822/teams/roster` (201 players) so the 1 MB roster body isn't committed.

## D5 player list (FAN-95)

Recorded by `npm run capture:yahoo-research` on 2026-11-07 (US Eastern) in league 478.l.14822, week 3, scrubbed of team, manager and league names. Each file is Yahoo's response body. Only `d5-available` was recorded in D5's exact form; the others were recorded with `/ownership` or with no `out`, so the tests add the missing `ownership` and `percent_owned` blocks in the shape `d5-available` shows.

| File | GET (with `?format=json`) | What it covers |
|---|---|---|
| `d5-available.json` | `/league/478.l.14822/players;status=A;start=0;count=25;out=ownership,percent_owned` | 25 rows: free agents, one waiver row (clears 2026-11-08), 12 NA, 5 O with reasons, 14 rows without a rostered % |
| `d5-waivers-ownership-only.json` | `/league/478.l.14822/players;status=W/ownership` | 5 waiver rows, clearing 2026-11-08 or 2026-11-09 |
| `d5-owned-last-page-ownership-only.json` | `/league/478.l.14822/players;status=T;start=200;count=25/ownership` | The last owned page: 1 row, team owner |
| `d5-position-c-no-out.json` | `/league/478.l.14822/players;status=A;position=C` | 25 centres |
| `d5-search-doncic.json` | `/league/478.l.14822/players;status=A;search=doncic` | An empty answer (`players: []`); Dončić is owned |

## D6 league schedule, rostered players' game logs (FAN-92)

Recorded by `npm run capture:yahoo-game-log` on 2026-11-08 (league date 2026-11-08) while PHI at CHI was live, scrubbed the same way. Saved here as the bare response bodies.

- Files: `d6-status-t-start-0.json`, `d6-status-t-start-25.json`
- GET `/league/478.l.14822/players;status=T;start={0,25};count=25;out=game_log` (with `?format=json`)
- 2026-11-08T21:54:18Z: HTTP 200 each; 25 players each, 25 NBA teams between them (no CHA, LAL, MEM, OKC or ORL); game logs from 2026-10-20 to 2026-11-16
