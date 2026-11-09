# Yahoo data for daily stats

What Yahoo's Fantasy API can supply for the [Daily Stats Experience brief](https://linear.app/shihhao-fan/document/daily-stats-experience-product-brief-9be81bb274cd), at what cost, and what it can't. Written for FAN-87, as of 2026-11-03.

> Superseded for planning by the Linear page "Daily stats data reference (source of truth)" and the [daily stats retrieval plan](daily-stats-retrieval.md) (FAN-97). Later research found Yahoo does return schedule and live game state (`out=game_log`), so the gaps below about schedule and game state no longer hold.

## How sure each answer is

Each finding carries one of three kinds of evidence:

- **Recorded:** the field is in a scrubbed response in `tests/backend/fixtures/yahoo/` (captured 2025-12-11 and 2026-10-20), or the call succeeded for an NBA league in the December 2025 run behind [`yahoo-api.md`](yahoo-api.md).
- **Documented:** Yahoo's Fantasy API guide or a maintained client library describes it, but we have no NBA response that shows it. Yahoo's own guide (`developer.yahoo.com`) wasn't reachable from the cloud session, so these rows lean on client libraries ([yahoo_fantasy_api](https://yahoo-fantasy-api.readthedocs.io/en/latest/yahoo_fantasy_api.html), [YFPY](https://yfpy.uberfastman.com/query/)).
- **None:** nothing found in either.

No call was made to the real Yahoo API for this check. The [probe list](#probe-list) names the calls an owner capture should record to turn every "documented" row into "recorded".

## Field by field

| Need (brief) | Status | Evidence | Yahoo call | Notes |
|---|---|---|---|---|
| Player stats for a date (today, yesterday, any date) | Available | Documented | `/team/{team}/roster;date={d}/players/stats;type=date;date={d}` | One call returns a team's lineup for that date with each player's stats for that date. NBA dates are US Eastern. |
| Player stats for a fantasy week | Available | Recorded (`type=week`, Dec 2025) | `…/players/stats;type=week;week={n}` | Counts all NBA games that week, whether or not the player was in the starting lineup. See [weekly aggregates](#questions-for-the-mockup-review). |
| Weekly stats that counted for the fantasy team | Partial | Recorded (inputs only) | One roster-with-date-stats call per team per day of the week (up to 7) | Yahoo returns no per-player "counted" total. It has to be summed from each day's stats where the player's slot that day was a starting slot. Team totals for the week (counted only) are in the scoreboard. |
| Lineup slots, including bench and IL | Available | Recorded | `/team/{team}/roster;date={d}` | `selected_position` is per date (`roster_type: date`); slots seen: PG, SG, G, SF, PF, F, C, Util, BN, IL, IL+. The league's slot list is in settings (`roster_positions`, with `is_starting_position`). Lineups lock per game (`weekly_deadline: intraday`). |
| Players added or dropped midweek | Partial | Recorded (roster by date); documented (transactions) | Roster per date, or `/league/{key}/transactions;types=add,drop;team_key={team}` | A dated roster shows who was on the team that day. Building "who was on the team when" for a week takes up to 7 roster calls or one transactions call per team. |
| Game status per player (not started, live, final, no game) | Missing | None | — | No player-level game state, opponent or tip-off time in the Fantasy API. |
| Game progress per fantasy team | Partial | Recorded | Scoreboard (already called) | `team_remaining_games` gives each team's `remaining_games`, `live_games` and `completed_games` for the week, and the matchup has `status` (`preevent`, `midevent`, `postevent`). Counts only; no per-player breakdown. |
| NBA schedule (today, tomorrow, back-to-backs, games left this week) | Missing | None | — | No NBA game or schedule resource. The scoreboard's `remaining_games` is the only schedule-derived number. Schedule filters need another source, which [the target state](../target-state.md) doesn't allow today ("Yahoo is the only source of fantasy data"). |
| Injury designation (GTD, Questionable, Out, …) | Available | Recorded | Any player in a roster or players call | `status` (`INJ`, `O`, `GTD`, `NA`, …), `status_full` ("Injured (IL-eligible)", "Not Active") and `injury_note` (body part or reason, e.g. "Ankle", "Coach's Decision"). Today's parser collapses these to active/injured/out (`server/fantasy/yahoo/player-parser.ts`); the brief needs the source value kept. |
| Latest player note, its source and time | Partial | Recorded (flags only) | Any player call | `has_player_notes`, `has_recent_player_notes` and `player_notes_last_timestamp` (Unix seconds). No note text or source was found in any call. Yahoo has said its news and injury designations come from different providers, so they can disagree. |
| Season per-game averages | Available | Documented | `…/players/stats;type=average_season` | Per-game values for the league's categories. |
| Season games played | Partial | Documented | `…/players/stats;type=season` | Whether GP comes back in a league's player stats (its stat list is the league's categories plus display-only ones) needs a probe. |
| Recent performance | Available | Recorded (`type=lastmonth`, Dec 2025); documented (`lastweek`) | `…/players/stats;type=lastweek` or `type=lastmonth` | Last 7 and last 30 days, totals. |
| Projections (tonight, next 7 days) | Missing | None | — | No projection resource or stat type is documented, and no client library exposes one. The brief says not to invent them; this is a scope gap to resolve. |
| Free agents and waivers for a league | Available | Recorded (`status=FA`, Dec 2025) | `/league/{key}/players;status=A;start={n};count=25` | `status` takes `A` (all available), `FA`, `W` (waivers), `T` (taken). Other filters: `position`, `search` (name), `sort` (stat id, `NAME`, `OR` overall rank, `AR` actual rank), `sort_type` (`season`, `date`, `lastweek`, `lastmonth`) with `sort_date`. 25 players per page. `ownership` adds team/free agent/waivers and the waiver date. |
| Filter free agents by NBA team | Partial | Documented | Same call, filtered by us | No NBA-team filter is documented; filter pages in the app. |
| Rostered % | Available | Documented | `…/players/percent_owned` | Share of all Yahoo leagues of that game where the player is rostered, not this league. Weekly coverage. |
| Add trends | Partial | Documented | `…/percent_owned` | Only `delta`, the change in rostered % for the coverage week, and libraries report it is sometimes absent. Yahoo's "trending adds" lists and add/drop counts weren't found. |

Every call here is read-only and fits the current `fspt-r` scope.

## Calls per screen

Estimates for the brief's screens, live reads as today. Several players' stats can share one call through `players;player_keys=a,b,…` (up to 25 keys).

| Screen | Calls | What |
|---|---|---|
| Matchup overview | 1 | `/league/{key};out=settings,scoreboard` (today's call) gives totals, makes/attempts, category winners and remaining/live/completed games for both teams. |
| Daily roster comparison (today or yesterday) | 2 | Roster with date stats for each of the two teams. |
| …with season averages | +2 | `average_season` for about 30 players. Changes once a day. |
| …with weekly player totals (all games) | +2 | `type=week` for both rosters. |
| …with weekly totals that counted | +up to 14 | Seven days × two teams. Past days never change, so they only need reading once. |
| Player details | 1–2 | Player with stats for the date, season average and last month; percent owned. |
| Free agents, one page | 1–2 | Players page with stats and percent owned. |
| League rankings | 1 | Today's season or week call. |

A first Matchup visit with daily stats and season averages is about 5 calls; refreshing during games needs only the 3 that change (scoreboard and two rosters).

## Refresh during games

- Yahoo's responses carry `refresh_rate` of 30 or 60 seconds, which is the most often it suggests asking.
- Yahoo publishes no numbers for its rate limit. Its [terms](https://legal.yahoo.com/us/en/yahoo/terms/product-atos/fantasysportsapi/index.html) say each app has one and that working around it is a breach; clients report HTTP 999 or 429 when it's hit. Our request policy already handles 429 with `Retry-After` and bounded retries.
- At most 14 users. With the Matchup screen open and refreshing every 60 seconds, that's 3 calls a minute per viewer, about 40 a minute if all 14 watch at once. That's modest, but unproven against an unpublished limit.
- **Recommendation:** promise "updated within about a minute" during games: refresh the scoreboard and today's rosters every 60 seconds while the screen is visible, and never on a hidden tab. Show the fetch time, as every view does today.

## Caching and storage

- **Phase 1 needs no stored stat history.** Any past date can be read again from Yahoo, so yesterday's results and the week's days are live reads.
- **Cache what changes once a day in the client**, not the server: season averages, last-month stats and percent owned can be kept for hours in the client's query cache. The server keeps no module state, so a server cache would need storage.
- **Counted weekly totals are the expensive part.** If the mockup keeps them, the server could store each finished day's per-player stats and slots, since they never change once settled. That would be the first stored fantasy data and a target-state change for FAN-89.
- **Schedule and projections can't come from Yahoo.** Schedule filters, per-player game state and projections need another source or must leave the scope; that is a decision for FAN-89 and the owner.

## Questions for the mockup review

These are for the owner and FAN-88, not answerable from data:

1. **Weekly player totals:** all NBA production that week (one cheap call), or only production that counted toward the fantasy team (up to 7 calls per team, or stored days)? Or both, labelled?
2. **Benched and IL players:** show their stats for the day, but marked as not counted? Count them in category contributions?
3. **Players added or dropped midweek:** show a dropped player's counted stats in the week view? Show an added player's games from before the pickup?
4. **Remaining games:** Yahoo's `remaining_games` is a single number per team. Is that what "games left" should mean, or games expected to count for the lineup?
5. **League ranking:** category strength (today's rank-sum view), official Yahoo standings, or both side by side?
6. **Projections and schedule:** with neither available from Yahoo, drop projections and schedule filters from Phase 2, or approve another data source?
7. **Player notes:** with only "has a note" and its time available, is a "news" marker linking to Yahoo's player page enough?

## Probe list

One owner capture (see [Yahoo fixture capture](../runbooks/yahoo-fixture-capture.md)) during a game night would confirm the documented rows. All read-only, for the owner's current league and team:

- `/team/{team}/roster;date={today}/players/stats;type=date;date={today}` during live games: confirms date stats and whether any game-state field appears.
- `/league/{key}/players;player_keys={3 rostered keys}/stats;type=average_season` and `type=season`: per-game values and whether GP is included.
- `/league/{key}/players;status=A;sort=AR;count=25/percent_owned` and `/ownership`: rostered %, `delta`, waiver dates.
- `/league/{key}/players;status=A;search={a name}` and `;position=C`: filters.
- `/league/{key}/transactions;types=add,drop`: midweek changes.
- `/player/{key}/stats;type=projected_week` (expected to fail): rules projections out.
