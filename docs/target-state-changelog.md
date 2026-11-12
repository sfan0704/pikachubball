# Target state changelog

One line per change to [the target state](target-state.md): the date, what changed, and the pull request. The reasoning is in the pull request.

- 2026-11-12 · League is the board alone: the Heatmap, Matchup, Compare and Roster tabs, the rankings-table fallback and the roster endpoint are gone, and Account (disconnect, delete) opens from the header · FAN-124 (PR pending)
- 2026-11-12 · A team-days range endpoint: Matchup Week reads each team's days before today in one request and today on its own, 6 requests instead of 16 for the same Yahoo calls; a range takes the shortest freshness class among its dates · FAN-120 (PR pending)
- 2026-11-12 · Players on in production; the load test counts the Players views' Yahoo calls, and the stand-in's league schedule completes in 3 pages · FAN-119 (PR pending)
- 2026-11-12 · A protected request makes one Supabase call before Yahoo: no auth-server user lookup, and one RPC checks the session and reads the Yahoo identity, league ownership and tokens · FAN-121 (PR pending)
- 2026-11-11 · Matchup and League on in production; the load test counts the daily-stats views' Yahoo calls through the Yahoo source against the stand-in (`LOCAL_DAILY_STATS=standin`); Matchup Week costs 16 calls, the popover reads D2 · FAN-116 (PR pending)
- 2026-11-11 · Players filters by NBA team, schedule and games left on the page shown, since Yahoo's player list can't; its first page also reads the scoring weeks (D10) for games left · FAN-110 (PR pending)
- 2026-11-11 · Game logs (D3) carry the player's line in each game, so the shared player detail shows today, yesterday and the week for rostered and available players alike · FAN-105 (PR pending)
- 2026-11-11 · The freshness policy times every dataset query, including the team table (current week and season Live, earlier weeks Settled) and rosters (Recent); a lint rule keeps query timers in the API module · FAN-108 (PR pending)
- 2026-11-11 · The season team table carries each team's official W–L–T from Yahoo's standings, for the League board · FAN-106 (PR pending)
- 2026-11-11 · The league schedule (D6) starts yesterday (US Eastern), so tonight in every US time zone is in it; tonight, tomorrow, back-to-back and games left this week are pure functions in shared/domain · FAN-118
- 2026-11-11 · Daily-stats URLs (`matchup/<day>`, `players`, League keeps `<scope>`) and the three feature switches in `GET /api/me` · FAN-103 (PR pending)
- 2026-11-09 · Daily stats: Matchup, Players and League read live from the Yahoo Fantasy API through one endpoint per dataset, combined in the browser; per-viewer live polling; no stored Yahoo data; one freshness policy (Live, Recent, Daily, Settled) applied by the client; projections slot off by default · #154 (FAN-97)
- 2026-11-03 · A failed request's log line carries its error code and, for an unreadable Yahoo response, the failing schema paths (no values) · FAN-86 (PR pending)
- 2026-10-21 · Every deploy checks the Yahoo sign-in provider and the Vercel variable scopes after its smoke check, with the database password and Vercel token it already holds; Auth's site URL and redirect allowlist stay a manual check (no Supabase access token) · CAR-100 (PR pending)
- 2026-10-20 · Optional read-only Vercel metadata acquisition checks project/team identity and saves only variable names and scopes, without decryption or deployment authority · #115
- 2026-10-19 · A deploy without a merge starts by re-running CI on `main`'s newest commit (a fresh *Deploy* run with current secrets), not by re-running an old *Deploy* run · CAR-142 (PR pending)
- 2026-10-19 · Deploy on merge: pull requests run checks only (plus a migration order check); when CI passes on a `main` commit, the Deploy workflow checks drift, migrates and deploys that exact commit with the Vercel CLI. No `production` branch, deploy key, approval or manual release · CAR-140 (PR pending)
- 2026-10-14 · Failed production smoke checks link the recovery runbook; the owner manually restores the last verified good deployment, and automation never changes production traffic · CAR-100 (PR pending)

- 2026-10-07 · First agreed version, moved into the repository from Notion · #16
- 2026-10-07 · Key rotation is configured with `ENCRYPTION_KEY_VERSION` · #27
- 2026-10-08 · Runbooks live in `docs/runbooks/`; reference docs in `docs/reference/` · #35
- 2026-10-10 · The user's leagues come from the teams and leagues calls together, with the league status rules · #83
- 2026-10-10 · At rollover, the leagues are rechecked at most once a day while Yahoo lists only finished ones · #84
- 2026-10-10 · `user_leagues` stores a status (preseason, active or finished) instead of only whether a league is finished · #89
- 2026-10-11 · The weekly keep-alive and schema dump run unattended as a `maintenance` database role that reads no rows · #96
- 2026-10-11 · Define remote worker lifecycle and authority; distinguish pending hosted delivery from verified state and the owner-only HTTPS exception · #93
- 2026-10-12 · A review environment (the build, a throwaway stack, synthetic users and the stand-in on the CI runner or worker) for seeing changes working; Vercel previews stay build-only · #101

- 2026-10-14 · Protected requests verify the caller’s active Supabase session to reject copied cookies immediately after logout; migrate before deploying the code · #108 (CAR-132)
- 2026-10-19 · No hosted dev; one baseline migration; releases check prod for drift and migrate with the database password only, with project refs written in the workflows · CAR-138 (PR pending)
- 2026-11-12 · Yahoo date stats send `-` before tip-off too: a `-` line whose game log has a scheduled or live game that date is not yet played · FAN-123
