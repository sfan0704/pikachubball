# Daily-stats call recordings (FAN-102)

Recorded by `npm run capture:yahoo-live-calls` in league 478.l.14822, scrubbed of team, manager and league names. Each file is Yahoo's response body.

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
