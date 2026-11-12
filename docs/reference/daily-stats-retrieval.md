# Daily stats retrieval plan

How the Matchup, Players and League screens get their data from Yahoo: the datasets, the call for each, how calls are batched and reused, how fresh each must be, and what it all costs. Written for FAN-97, as of 2026-11-11 (FAN-102 call tests added; D7, D8 and D9 connected in FAN-115). The agreed architecture is in [the target state](../target-state.md#daily-stats); this page holds the detail behind it.

Inputs: the Linear page "Daily stats data reference (source of truth)" (final for FAN-89, 2026-11-09), the FAN-88 mockup decisions and research FAN-91 to FAN-96. Every call below was tested in our league; D3's multi-key form and D7's `team_key` form were tested on 2026-11-10 (FAN-102). Next 7 projected (FAN-94) is not part of this plan; see [Projections slot](#projections-slot).

## Rules every dataset follows

- **One source.** Every dataset comes from the Yahoo Fantasy API with the signed-in user's OAuth token (`fspt-r`). No website routes, no cookies, no outside source. BALLDONTLIE and ESPN stay documented fallbacks only.
- **Per user, never shared.** Each viewer's calls run with their own token and their results stay in their own browser. Nothing from Yahoo is stored on the server ([Storage](#storage-and-yahoos-agreement)).
- **Batch by 25.** Player-key calls carry at most 25 keys (Yahoo caps lists at 25 rows). The Yahoo resource layer splits longer lists and runs the chunks in parallel.
- **One Yahoo call per identical request.** Within one API request, the Yahoo client memoizes identical calls. Across requests, TanStack Query in the browser dedupes in-flight requests by key and serves fresh results from memory.
- **Missing is not zero.** Each stat value is one of: a number, `no game` (Yahoo `-`), `did not play` (team played, player didn't), `not yet played` (Yahoo `""`; in date stats Yahoo also sends `-` before tip-off, so a `-` line whose game log has that date's game scheduled or live is not yet played) or `unavailable` (the call failed or the field is absent). The parsers produce these as a tagged union in `shared/domain`; nothing turns them into 0.
- **Today's status only.** Injury `status` and `injury_note` are always today's values and are never shown against a past date.

## Datasets

`L` league key, `T` team key, `P` player key, `W` week, `D` date (US Eastern). The freshness classes are defined in [Freshness policy](#freshness-policy).

| # | Dataset | Yahoo call | Calls | Used by | Freshness class |
|---|---|---|---|---|---|
| D1 | Week table: every team's totals, pairings, games left | `/league/{L};out=settings/scoreboard;week={W}` (the existing scope call; it gains `remaining_games`, `live_games`, `completed_games`) | 1 | Matchup grid, score, games left, opponent picker; League week ranks | Current week: Live. Past week: Settled |
| D2 | Team day: one team's roster on a date with each player's slot and stats that date | `/team/{T}/roster;date={D}/players/stats;type=date;date={D}` | 1 per team per date | Matchup Today, Yesterday and Week player cards | Today: Live. Yesterday and the day before: Recent (stat corrections). Older: Settled |
| D3 | Game logs: each player's NBA games (date, opponent, home/away, tip-off, live quarter/clock/score, final, minutes and the player's nine-category line in that game) | `/league/{L}/players;player_keys={P1..P25};out=game_log` (tested 2026-11-10 with 25 keys, 4 games live: every player came back with their log; about 350 KB a call) | 1 per 25 players | Matchup game status, did-not-play, counted games; player detail | Live |
| D4 | Player period totals with GP and makes/attempts | `/players;player_keys={P1..P25}/stats;type={season,lastweek,lastmonth}` (game context, no `/league` prefix) | 1 per 25 players per period | Matchup vs season average; Players averages; League popover per-game PTS/REB/AST | Daily (Yahoo's periods end yesterday) |
| D5 | Player list page: ownership, waiver date, rostered % and trend, positions, NBA team, injury status | `/league/{L}/players;status={A,T,W}[;position={pos}][;search={text}];sort={AR,OR};start={N};count=25;out=ownership,percent_owned` | 1 per page | Players lists, search and position filter | Recent |
| D6 | League schedule: every NBA team's games from yesterday (US Eastern, so every US time zone's tonight is in it) to about 8 days ahead; a team no one in the league rosters is left out | `/league/{L}/players;status=T;start={N};count=25;out=game_log`, paged until all 30 NBA teams are covered | 2 to 4 expected, at most 9 | Players tonight, tomorrow, back-to-back filters and games this week | Daily |
| D7 | Transactions for a team | `/league/{L}/transactions;types=add,drop,trade;team_key={T}` (tested 2026-11-10: returns the team's adds, drops and trades, as trader or tradee, and nothing else; matches the whole feed for that team) | 1 | Matchup added/dropped labels; League popover latest acquisition | Recent |
| D8 | Draft results | `/league/{L}/draftresults` (an auction is told by its picks carrying a cost; snake picks have none) | 1 | League popover draft label | Settled |
| D9 | Current roster for a team | Served by D2 for today, which the popover reads (FAN-106), so it is not a separate call | 1 | League popover roster | Today's D2 class |
| D10 | Scoring weeks | `/game/{G}/game_weeks` | 1 | Week picker, games this week, League period names ("Week 3 · Nov 2–8") | Settled |

**Fallback for D3.** Not needed: the multi-key form worked (FAN-102). Kept in case Yahoo changes it: the `status=T` pages (D6's call): 9 calls cover every rostered player in the league, which includes both Matchup teams. Dropped contributors in the Week view are no longer rostered; their days come from D2, where `0`/`0/0` on a game day already says the team played.

**Week view.** Seven D2 calls per team (one per elapsed date), not the one-call week roster: that shortcut was not checked on a week with bench games. Counted totals are the sum of starting-slot days, which reconciled exactly with Yahoo's daily and weekly team totals in FAN-91.

**Week requests (FAN-120).** Every API request pays the same sign-in and storage checks before its Yahoo calls, so the Week view asks for each team's days before today in one request, `GET /api/leagues/:key/teams/:team/days?from=&to=` (at most 14 dates, Yahoo's longest scoring week). The server makes the same D2 call per date, in parallel within the request. Today stays its own request, the one the Today view makes. On the last day of the week, Matchup Week from nothing is 6 API requests (D10, D1, and a range plus today for each team) instead of 16, for the same 16 Yahoo calls; coming from Today, it is 3 (D10 and the two ranges). A failed date fails its whole range; today still shows under the error.

**Games left.** `remaining_games` follows the lineup as currently set (Howard's Sabonis test), so D1 is refetched whenever the user comes back to the tab, not only on a timer.

## Freshness policy

Freshness is managed in one place: a policy in `shared/domain` that the browser applies to every dataset. No screen, hook or endpoint sets its own timer.

| Class | Fresh for | Polls | Datasets |
|---|---|---|---|
| Live | 2 minutes | Every 2 minutes, only while a shown game is live and the tab is visible | D1 current week and season to date, D2 today, D3 |
| Recent | 10 minutes | No | D2 yesterday, the day before and future dates (lineups can still change), D5, D7 |
| Daily | 6 hours | No | D4, D6 |
| Settled | The whole visit | No | D1 past weeks, D2 older days, D8, D10 |

- **Ranges of days.** Several D2 dates read in one request take the shortest class among them. The Week view keeps today out of its range, so the range never polls as Live: it is Recent while it holds yesterday or the day before, and Settled otherwise. The cost is that a stale Recent range re-reads all its dates (up to 6 calls a team instead of 2), and only when the view is shown again or the tab regains focus after 10 minutes.
- **One table, one function.** The class of each dataset is a single table in `shared/domain`. A pure function takes the dataset (with its date or week), the current time and whether any shown game is live, and returns how long the data stays fresh and whether to poll. Changing a timer is a one-line change, tested with a fixed clock. Live data counts as Recent when no shown game is live.
- **One live signal.** "Games live now" is derived from the game logs (D3) of the players on screen (`is_game_live`, or a tip-off that has passed without a final, for at most 4 hours so a postponed game can't keep it on). It switches polling on and off for every Live dataset at once, and turns polling back on at the next shown tip-off.
- **Applied by the query-key factory.** The factory that builds every TanStack Query key also attaches the policy's fresh time and poll interval, so no component sets them (`freshQuery` in `client/src/api`, built in FAN-108; a lint rule rejects query timers anywhere else in the client). Stale data refetches when it is next shown or the tab regains focus; D1's current week refetches on every return to the tab, fresh or not (`followsLineup`), because games left follow the lineup.
- **One freshness label.** A shared component reads each query's last success time and error state and shows "updated N min ago", or a stale label after a failed refresh. The Matchup header shows the oldest age among its sections.
- **Backoff in the same place.** A `YAHOO_RATE_LIMITED` response doubles the poll interval (2, 4, 8 minutes, at most 10) until a poll succeeds. `YAHOO_UNAVAILABLE` keeps the interval and marks the data stale.
- **The server stays out of it.** It only stamps each response with its fetch time. It keeps no cache and sets no cache headers; API responses stay private and uncacheable.
- **No background work, no shared writes.** Polling runs only in open browser tabs. The server keeps nothing between requests and writes nothing for daily stats, so it scales to any number of instances without coordination. **Accepted trade-off** (Howard, 2026-11-10): viewers of the same game each make their own Yahoo calls, up to about 2,500 an hour on a busy night. If Yahoo starts rate-limiting, a shared cache is the fix, and it would then need a guard against instances writing the same data at once.
- **Corrections.** Yahoo corrects stats overnight, which is why yesterday and the day before are Recent rather than Settled.

Not chosen: a server-side cache (needs stored, shared data and the agreement check) and HTTP cache headers (API responses are private, and the browser's HTTP cache can't be inspected, labelled or tested).

## Consolidations and what each saves

| Consolidation | Instead of | Saves |
|---|---|---|
| Game logs carry schedule, live state and minutes together (D3) | A schedule call, a game-state call and a per-day GP call (`/players/stats;type=date`) for each date | About 7 calls per Week view |
| One week table serves Matchup and League (D1) | Separate scoreboard and stats calls per team | 13 calls per week (one per other team) |
| Settings ride along with D1 | A separate settings call | 1 call per scope |
| `out=ownership,percent_owned` in one list call (D5) | Separate ownership and percent-owned calls | 1 call per page |
| Players fetches only the selected period's stats (D4) | All three periods for every page | 2 calls per page until the user switches |
| NBA team, schedule and back-to-back filters run in the browser on rows already loaded | Server round trips per filter | All filter taps are free |
| Season, lastweek and lastmonth totals are reused for 6 hours across screens (D4) | Refetching per screen | Every repeat visit that day |

`stats_collection` (all periods in one call, undocumented) would save 2 more calls per page; it stays unused while the documented call is cheap enough.

## Call budgets

Counted per viewer, first attempts only. FAN-102 confirmed D3 and D7 work in the planned forms, so neither needs its fallback's extra calls. A D3 call returns each player's whole season log plus about 8 days ahead, about 350 KB for 25 players, so live polling moves about 0.35 MB a minute per viewer between Yahoo and the server. The request policy allows up to 3 attempts for timeouts and 5xx, so a failing minute can cost up to three times its count. A rostered team has about 15 players, so both Matchup teams together are about 30.

**Cold start** (nothing in the browser yet):

| Visit | Calls |
|---|---|
| Matchup, Today | D1 1 + D2 2 + D3 2 + D4 season 2 = **7** |
| Then Yesterday | D2 2 = **2** |
| Then Week, on the last day of the week | D10 1 + D2 12 more (14 in all) = **13**, in 3 API requests |
| Matchup Week, straight to it on the last day | D10 1 + D1 1 + D2 14 = **16**, in 6 API requests |
| A past week | Same as above, **16**, then free for the session |
| Players, first page | D5 1 + D4 1 + D6 2 to 4 + D10 1 (none if Matchup Week already read it this visit) = **4 to 7** |
| Players, each further page, search or position change | D5 1 + D4 1 = **2**, or **3** on Last 7 or Last 30 (D4 season too, for the colours) |
| Players, switch period | D4 1 per loaded page (Season is usually already loaded, so going back is 0) |
| Players, NBA team, schedule, games-left filter or sort | **0**: Yahoo can't filter on these, so they apply to the page shown |
| League, rankings | D1 or season table 1 + D10 1 (none if already read this visit) = **1 to 2** |
| League, first team popover | D2 today 1 + D4 1 + D7 1 + D8 1 = **4**; later popovers **3**, and 2 for a team already on the Matchup screen |

**Warm navigation:** 0 calls for anything still fresh under the [freshness policy](#freshness-policy). Switching between Today, Yesterday and Week, between categories, opponents or sort orders, or back to a screen already open costs nothing.

**Live refresh:** while any game shown on the Matchup screen is live and the tab is visible, every 2 minutes: D1 (1), D2 today for both teams (2) and D3 (2), 5 calls. About **3 calls a minute** per viewer (2.5). Polling stops when no shown game is live and restarts at the next shown tip-off (`start_time`). Hidden tabs don't poll; returning to the tab refetches what is stale.

**League totals for 14 users:**

| Day | Assumption | Calls |
|---|---|---|
| Typical | Each user: one Matchup visit, one Week look, a few Players pages, one popover (about 35 calls) and 60 minutes of live viewing (about 180) | About **3,000** |
| Busy game night | Every user watches live for 3 hours | About **8,100**; at most about **2,500 in one hour** (14 × 3 × 60) |

Yahoo publishes no rate limit for the Fantasy API. A third-party listing claims 2,000 requests an hour per user (unverified); our worst hour is about 180 per user. The only measured block was the website's HTTP 999 after about 390 page loads in 5 minutes, which doesn't apply to API calls.

## Live state and freshness

- **Game windows.** D3 tells each shown player's game state: scheduled (tip-off from `start_time`), live (`is_game_live` is the number `1` on the game; quarter, clock and score parsed from `status`, recorded as `Q1 1:17, 23-18`), final (`W`/`L` and score). Unknown live texts (halftime, overtime, delays) are shown as Yahoo wrote them.
- **Partial failures.** Each dataset loads and fails on its own. The totals grid (D1) can show while player cards (D2) retry; a failed section shows its error with a retry button, and values already on screen stay, labelled with their age.
- **Timers, backoff and labels** follow the [freshness policy](#freshness-policy).

## Access and identity

- **League first.** Every new endpoint checks the league against the user's stored leagues before calling Yahoo, as today.
- **Team and player keys** must belong to that league's game (`{game}.l.{league}.t.{n}` for teams, `{game}.p.{n}` for players); anything else is `VALIDATION_ERROR` without a Yahoo call. Yahoo decides what the user can actually read.
- **Identity.** Players by Yahoo player key, NBA teams by `editorial_team_abbr`, games by Yahoo `game_id`. Dates are US Eastern; the browser shows times in the user's time zone.

## Storage and Yahoo's agreement

FAN-97 was asked what Yahoo's API Access and Use Agreement (the DocuSign agreement from the July 2026 access reset) allows us to store. The signed copy is with Howard, and Yahoo's public Fantasy Sports API terms (`legal.yahoo.com`) aren't reachable from the cloud session, so this plan doesn't depend on the answer: it stores no Yahoo data at all, which is what the target state already does.

The budgets above show reading live is affordable. Two stores remain options if a revisit trigger fires and Howard confirms the agreement allows them:

1. **Finished days per user**: each user's own D2 results for settled dates, in a table only they can read. Saves up to 14 calls per Week view. Safe under the current trust model, since a user who tampers with their own rows only affects their own view.
2. **A shared game-state poll**: one D3 poll per league shared by every viewer. Cuts live polling roughly by the number of concurrent viewers, but needs a database role only the server holds, because users can write their own rows through Supabase's Data API (see Decisions in the target state).

Clauses to check in the agreement before either: storage or caching limits and how long data may be kept; whether data retrieved for one user may be shown to another member of the same league; deletion on request or when access ends; required attribution; call-volume limits.

## Projections slot

Next 7 projected (FAN-94) stays out. It would need a website session cookie, server-rendered HTML parsing and Howard's FAN-99 day-7 check on 2026-11-15. The design leaves room for it without building any of it:

- **Server.** A `ProjectionSource` interface in `server/fantasy` with one method returning next-seven-day totals per player key. No implementation exists, so the composition root registers no projections route.
- **Capabilities.** `GET /api/me` returns the features the server has wired, for example `{ projections: false }`. The client shows the Next 7 projected option only when it is `true`.
- **Turning it on** is a separate ticket after FAN-94 is decided: implement the source, add its secret to the configuration schema, wire it in the composition root, and add a D-row with its budget (about 9 page loads a day for rostered and available players, once a day).

## Static screens before live data

The `shared/api` contracts are the boundary. The first implementation ticket writes the contracts and the pure `shared/domain` functions, then builds the screens against fixtures that pass those contracts. A fixture `DailyStatsSource` serves them in local, CI and review only, wired in the same place as the Yahoo stand-in, so every interaction can be finished and reviewed signed-in before any Yahoo adapter exists. Production shows each daily-stats screen through the same feature list as projections only once its datasets are connected: Matchup and League since FAN-116, Players since FAN-119. Later tickets add the Yahoo resources and parsers one dataset at a time, each tested against scrubbed recordings from FAN-98's capture. D3 and D7 recordings are committed in `tests/backend/fixtures/yahoo/daily-stats/` (FAN-102, `npm run capture:yahoo-live-calls`). The Yahoo source's shared pieces (FAN-107) are in `server/fantasy/yahoo/`: `DailyStatsRequests` (25-key batching, per-request memoization, one log line per call, error codes), the key checks and the stat value parsers. Hook-up tests replay recordings through `replayYahoo` in `tests/support/yahoo-recordings.ts` and assert its call count against [Call budgets](#call-budgets). Before a release, `npm run load` makes each Matchup, League and Players view's requests for 14 users at once through the Yahoo source against the stand-in and checks each against these budgets. Outside local, CI and review the composition root builds the Yahoo source, and production shows a screen only once its entry in the feature list is turned on.
