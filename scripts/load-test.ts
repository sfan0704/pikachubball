// Simulates 14 managers using the app at the same moment, against the local
// stack and the Yahoo stand-in (never real Yahoo): `npm run load`.
// Each phase starts with every user at once. It reports how long league views
// take against the 2-second target and how many Yahoo calls each phase made.
// The daily-stats phases make the requests the Matchup, League and Players
// screens make and hold each to its call budget
// (docs/reference/daily-stats-retrieval.md).
import { SEED_LEAGUE_KEY, seedUsers, type SeedUser } from "../server/dev/seed-users";

// scripts/load-test.sh passes this workspace's ports (scripts/workspace.mts).
const BASE = process.env.LOAD_BASE_URL ?? "";
const STANDIN = process.env.LOAD_STANDIN_URL ?? "";
const USERS = 14;
const TARGET_MS = 2000;
// A browser opens at most 6 connections to one host over HTTP/1.1, as the local
// app serves, so each user has at most 6 requests in flight, as many as Matchup Week asks for.
const CONNECTIONS_PER_USER = 6;

if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(BASE) || !/^http:\/\/127\.0\.0\.1:/.test(STANDIN)) {
  throw new Error("The load test only runs against a local app and the local Yahoo stand-in");
}

class Session {
  private readonly cookies = new Map<string, string>();
  private inFlight = 0;
  /** API requests sent so far, for each phase's requests per user. */
  requests = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly user: SeedUser) {}

  async signIn(): Promise<void> {
    const response = await fetch(`${BASE}/api/dev/login?user=${this.user.key}`, {
      redirect: "manual",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const [name, ...value] = pair.split("=");
      this.cookies.set(name, value.join("="));
    }
    if (response.status !== 303 || this.cookies.size === 0) {
      throw new Error(`Sign-in failed for ${this.user.email}: ${response.status}`);
    }
  }

  /** A GET as the signed-in user; returns how long it took. */
  async get(path: string): Promise<number> {
    const started = performance.now();
    await this.json(path);
    return performance.now() - started;
  }

  /** A GET as the signed-in user, on one of the user's connections; returns the body. */
  async json(path: string): Promise<unknown> {
    if (this.inFlight >= CONNECTIONS_PER_USER) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.inFlight += 1;
    this.requests += 1;
    try {
      const response = await fetch(`${BASE}${path}`, {
        headers: { Cookie: [...this.cookies].map(([n, v]) => `${n}=${v}`).join("; ") },
      });
      if (!response.ok) {
        throw new Error(`${path} answered ${response.status} for ${this.user.email}`);
      }
      return await response.json();
    } finally {
      this.inFlight -= 1;
      this.waiting.shift()?.();
    }
  }

  get teamKey(): string {
    return this.user.teamKey;
  }
}

async function yahooCalls(): Promise<number> {
  const state = (await (await fetch(`${STANDIN}/__state`)).json()) as { requests: string[] };
  return state.requests.length;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

interface PhaseResult {
  readonly name: string;
  readonly timings: number[];
  readonly calls: number;
  readonly expectedCalls: number;
  /** API requests each user sent, on average. */
  readonly requestsPerUser: number;
  readonly isView: boolean;
}

/** Runs one step for every user at once and counts the Yahoo calls it caused. */
async function phase(
  name: string,
  sessions: Session[],
  expectedCalls: number,
  isView: boolean,
  step: (session: Session) => Promise<number>
): Promise<PhaseResult> {
  const before = await yahooCalls();
  const sent = () => sessions.reduce((sum, session) => sum + session.requests, 0);
  const sentBefore = sent();
  const timings = await Promise.all(sessions.map(step));
  return {
    name,
    timings,
    calls: (await yahooCalls()) - before,
    expectedCalls,
    requestsPerUser: (sent() - sentBefore) / sessions.length,
    isView,
  };
}

const table = (scope: string) => `/api/leagues/${SEED_LEAGUE_KEY}/${scope}`;
const league = `/api/leagues/${SEED_LEAGUE_KEY}`;

// The recorded current week is week 8, 2025-12-08 to 2025-12-14; "today" is its last day.
const WEEK_DATES = Array.from({ length: 7 }, (_, i) => `2025-12-${String(8 + i).padStart(2, "0")}`);
const TODAY = WEEK_DATES[6];

/** The other team in a user's pairing of the current week. */
async function opponentOf(session: Session): Promise<string> {
  const current = (await session.json(table("current"))) as {
    pairings: { teamKeys: [string, string] }[];
  };
  const pairing = current.pairings.find(({ teamKeys }) => teamKeys.includes(session.teamKey));
  const opponent = pairing?.teamKeys.find((key) => key !== session.teamKey);
  if (opponent === undefined) {
    throw new Error(`${session.teamKey} has no opponent in the current week`);
  }
  return opponent;
}

/** A team's players on a day (D2), as the Matchup screen asks for them. */
async function teamDay(session: Session, teamKey: string, date: string): Promise<string[]> {
  const day = (await session.json(`${league}/teams/${teamKey}/days/${date}`)) as {
    players: { player: { playerKey: string } }[];
  };
  return day.players.map(({ player }) => player.playerKey);
}

/** Matchup Today from nothing: D1, both teams' D2, then D3 and D4 season for their players. */
async function matchupToday(session: Session, opponent: string): Promise<number> {
  const started = performance.now();
  const [, mine, theirs] = await Promise.all([
    session.json(table("current")),
    teamDay(session, session.teamKey, TODAY),
    teamDay(session, opponent, TODAY),
  ]);
  const players = [...mine, ...theirs].join(",");
  await Promise.all([
    session.json(`${league}/games?players=${players}`),
    session.json(`${league}/player-stats/season?players=${players}`),
  ]);
  return performance.now() - started;
}

/** A team's days before today (D2, one call a day), in one request as the Week view asks. */
function earlierDays(session: Session, teamKey: string): Promise<unknown> {
  const [from, to] = [WEEK_DATES[0], WEEK_DATES[WEEK_DATES.length - 2]];
  return session.json(`${league}/teams/${teamKey}/days?from=${from}&to=${to}`);
}

/**
 * Matchup Week straight from nothing on the week's last day: D10, D1, and
 * each team's earlier days in one request plus today on its own: 6 requests.
 */
async function matchupWeek(session: Session, opponent: string): Promise<number> {
  const started = performance.now();
  await Promise.all([
    session.json(`${league}/weeks`),
    session.json(table("current")),
    ...[session.teamKey, opponent].flatMap((teamKey) => [
      earlierDays(session, teamKey),
      teamDay(session, teamKey, TODAY),
    ]),
  ]);
  return performance.now() - started;
}

/** One live refresh (every 2 minutes while a shown game is live): D1, today's D2 for both teams, D3. */
async function liveRefresh(session: Session, opponent: string): Promise<number> {
  const started = performance.now();
  const [, mine, theirs] = await Promise.all([
    session.json(table("current")),
    teamDay(session, session.teamKey, TODAY),
    teamDay(session, opponent, TODAY),
  ]);
  await session.json(`${league}/games?players=${[...mine, ...theirs].join(",")}`);
  return performance.now() - started;
}

/** The first League team popover, for a team not on the Matchup screen: D2 today, D4 season, D7, D8. */
async function firstPopover(session: Session, teamKey: string): Promise<number> {
  const started = performance.now();
  const players = await teamDay(session, teamKey, TODAY);
  await Promise.all([
    session.json(`${league}/player-stats/season?players=${players.join(",")}`),
    session.json(`${league}/teams/${teamKey}/transactions`),
    session.json(`${league}/draft`),
  ]);
  return performance.now() - started;
}

/** One page of the Players list (D5) and the season totals of its players (D4), as the screen asks. */
async function playersPage(session: Session, query: Record<string, string>): Promise<number> {
  const started = performance.now();
  const params = new URLSearchParams({
    status: "available",
    sort: "actualRank",
    start: "0",
    ...query,
  });
  const page = (await session.json(`${league}/players?${params}`)) as {
    players: { player: { playerKey: string } }[];
  };
  const keys = page.players.map(({ player }) => player.playerKey).join(",");
  await session.json(`${league}/player-stats/season?players=${keys}`);
  return performance.now() - started;
}

/** Players from nothing: the first page with its totals, the league schedule (D6) and the weeks (D10). */
async function playersFirstPage(session: Session): Promise<number> {
  const started = performance.now();
  await Promise.all([
    playersPage(session, {}),
    session.json(`${league}/schedule`),
    session.json(`${league}/weeks`),
  ]);
  return performance.now() - started;
}

/**
 * Each user's Players visit. The NBA team, schedule and games-left filters
 * apply to the page shown and send nothing, so they cost 0 calls by
 * construction; the client tests hold that.
 */
async function playersPhases(sessions: Session[]): Promise<PhaseResult[]> {
  const n = sessions.length;
  return [
    await phase("Players, first page, cold (6)", sessions, 6 * n, true, playersFirstPage),
    await phase("Players, next page (2)", sessions, 2 * n, true, (s) =>
      playersPage(s, { start: "25" })
    ),
    await phase("Players, search (2)", sessions, 2 * n, true, (s) =>
      playersPage(s, { search: "Doncic" })
    ),
    await phase("Players, position change (2)", sessions, 2 * n, true, (s) =>
      playersPage(s, { position: "C" })
    ),
  ];
}

/** Each user's Matchup and League visits, each phase held to its per-user call budget. */
async function dailyStatsPhases(sessions: Session[]): Promise<PhaseResult[]> {
  const opponents = new Map<Session, string>();
  for (const session of sessions) {
    opponents.set(session, await opponentOf(session));
  }
  const opponent = (session: Session) => opponents.get(session) ?? "";
  // A team that is neither the user's nor their opponent's, so its day isn't loaded yet.
  const stranger = (session: Session) =>
    sessions
      .map((other) => other.teamKey)
      .find((key) => key !== session.teamKey && key !== opponent(session)) ?? "";
  const n = sessions.length;
  return [
    await phase("Matchup Today, cold (7 each)", sessions, 7 * n, true, (s) =>
      matchupToday(s, opponent(s))
    ),
    await phase("Matchup Week, last day, cold (16)", sessions, 16 * n, true, (s) =>
      matchupWeek(s, opponent(s))
    ),
    await phase("live refresh, one 2-min tick (5)", sessions, 5 * n, false, (s) =>
      liveRefresh(s, opponent(s))
    ),
    await phase("League, first team popover (4)", sessions, 4 * n, false, (s) =>
      firstPopover(s, stranger(s))
    ),
  ];
}

async function main(): Promise<void> {
  await fetch(`${STANDIN}/__scenario`, {
    method: "POST",
    body: JSON.stringify({ scenario: "ok" }),
  });
  const sessions = seedUsers(USERS).map((user) => new Session(user));
  await Promise.all(sessions.map((session) => session.signIn()));

  const results: PhaseResult[] = [];
  // Opening the league view: who I am and my leagues, then the table of the starting scope.
  results.push(
    await phase("open the league view", sessions, USERS, true, async (session) => {
      const started = performance.now();
      await Promise.all([session.get("/api/me"), session.get("/api/leagues")]);
      await session.get(table("current"));
      return performance.now() - started;
    })
  );
  for (const scope of ["season", "1", "2"]) {
    results.push(
      await phase(`switch to a new scope (${scope})`, sessions, USERS, true, (session) =>
        session.get(table(scope))
      )
    );
  }
  // Going back to a scope already loaded, or comparing teams, needs no request: the
  // client keeps the table and computes comparisons itself. Zero calls is what is measured.
  results.push(await phase("repeat views and comparisons", sessions, 0, false, async () => 0));
  results.push(
    await phase("open a roster", sessions, USERS, false, (session) =>
      session.get(`/api/leagues/${SEED_LEAGUE_KEY}/teams/${SEED_LEAGUE_KEY}.t.3/roster`)
    )
  );

  results.push(...(await dailyStatsPhases(sessions)));
  results.push(...(await playersPhases(sessions)));

  let failed = false;
  console.log(`${USERS} users at once; target ${TARGET_MS} ms per league view\n`);
  console.log(
    "phase                                  p50 ms   p95 ms   max ms   requests/user   yahoo calls (expected)"
  );
  for (const result of results) {
    const sorted = [...result.timings].sort((a, b) => a - b);
    const callsOk = result.calls === result.expectedCalls;
    const timeOk = !result.isView || percentile(sorted, 95) <= TARGET_MS;
    failed ||= !callsOk || !timeOk;
    console.log(
      `${result.name.padEnd(36)} ${percentile(sorted, 50).toFixed(0).padStart(7)} ${percentile(sorted, 95).toFixed(0).padStart(8)} ${sorted[sorted.length - 1].toFixed(0).padStart(8)}   ${String(result.requestsPerUser).padStart(13)}   ${String(result.calls).padStart(3)} (${result.expectedCalls}) ${callsOk && timeOk ? "ok" : "FAIL"}`
    );
  }
  console.log(failed ? "\nFAILED" : "\nPassed");
  process.exit(failed ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
