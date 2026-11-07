// The calls behind a finished matchup week capture (FAN-91), shared by
// capture-yahoo-week.ts and the combined research capture. Every call is a
// read-only GET; a call Yahoo refuses is listed in probes.json with its status.
import { fetchJson, leaguesOf, probe, USER_TEAMS_PATH } from "../yahoo-capture-client";
import { datesBetween } from "./discover";

interface Matchup {
  week: number;
  dates: string[];
  team: string;
  opponent: string;
}

interface ProbeResult {
  file: string;
  path: string;
  status: number | "ok";
}

function firstMatch(text: string, pattern: RegExp, what: string): string {
  const match = pattern.exec(text);
  if (!match?.[1]) {
    throw new Error(`Yahoo's response has no ${what}`);
  }
  return match[1];
}

/** Objects anywhere in a response that carry the given key. */
function objectsWith(value: unknown, key: string, found: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => objectsWith(item, key, found));
  } else if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (key in record) {
      found.push(record);
    }
    Object.values(record).forEach((item) => objectsWith(item, key, found));
  }
  return found;
}

/** Your matchup in a week's scoreboard: its dates and the opponent's team key. */
function matchupOf(scoreboard: unknown, team: string, week: number): Matchup {
  for (const matchup of objectsWith(scoreboard, "week_start")) {
    const teams = [...JSON.stringify(matchup).matchAll(/"team_key":"([^"]+)"/g)].map((m) => m[1]);
    const opponent = teams.find((key) => key !== team);
    if (teams.includes(team) && opponent) {
      const dates = datesBetween(String(matchup.week_start), String(matchup.week_end));
      return { week, dates, team, opponent };
    }
  }
  throw new Error(`Week ${week}'s scoreboard has no matchup for ${team}`);
}

function teamKeysIn(response: unknown): string[] {
  return [...JSON.stringify(response).matchAll(/"team_key":"([^"]+)"/g)].map((m) => m[1] ?? "");
}

function playerKeysIn(response: unknown): Set<string> {
  const text = JSON.stringify(response);
  return new Set([...text.matchAll(/"player_key":"([^"]+)"/g)].map((m) => m[1] ?? ""));
}

/** Players on a team's roster for some days of the week but not all: midweek moves. */
function movers(dailyRosters: unknown[]): string[] {
  const days = dailyRosters.map(playerKeysIn);
  const everyone = new Set(days.flatMap((day) => [...day]));
  return [...everyone].filter((key) => days.some((day) => !day.has(key)));
}

function teamProbes(league: string, team: string, side: string, week: Matchup) {
  const w = week.week;
  return [
    [`${side}-stats-week.json`, `/team/${team}/stats;type=week;week=${w}`],
    [
      `${side}-roster-week-stats.json`,
      `/team/${team}/roster;week=${w}/players/stats;type=week;week=${w}`,
    ],
    [`${side}-transactions.json`, `/league/${league}/transactions;types=add,drop;team_key=${team}`],
    ...week.dates.flatMap((date) => [
      [
        `${side}-${date}-roster-stats.json`,
        `/team/${team}/roster;date=${date}/players/stats;type=date;date=${date}`,
      ],
      [`${side}-${date}-stats.json`, `/team/${team}/stats;type=date;date=${date}`],
    ]),
  ];
}

function moverProbes(league: string, side: string, keys: string[], week: Matchup) {
  if (keys.length === 0) {
    return [];
  }
  const players = `/league/${league}/players;player_keys=${keys.join(",")}`;
  return [
    [`${side}-movers-week.json`, `${players}/stats;type=week;week=${week.week}`],
    ...week.dates.map((date) => [
      `${side}-movers-${date}.json`,
      `${players}/stats;type=date;date=${date}`,
    ]),
  ];
}

async function runProbes(paths: string[][], token: string, files: Map<string, unknown>) {
  const results: ProbeResult[] = [];
  for (const [file = "", path = ""] of paths) {
    const result = await probe(path, token);
    if (result.ok) {
      files.set(file, result.body);
    }
    results.push({ file, path, status: result.ok ? "ok" : result.status });
  }
  return results;
}

/**
 * Records one finished week of your matchup: scoreboards, both teams' weekly and
 * daily rosters and totals, and the players who moved, keyed by output file name.
 */
export async function recordWeek(
  token: string,
  chosenLeague?: string,
  chosenWeek?: number
): Promise<Map<string, unknown>> {
  const userTeams = await fetchJson(USER_TEAMS_PATH, token);
  const league = chosenLeague ?? leaguesOf(userTeams)[0];
  // Filtering parsed keys, not building a pattern from the league argument.
  const team = league && teamKeysIn(userTeams).find((key) => key.startsWith(`${league}.t.`));
  if (!league || !team) {
    throw new Error("Yahoo lists no NBA team for this account in that league");
  }
  const current = await fetchJson(`/league/${league};out=settings,scoreboard`, token);
  const week =
    chosenWeek ??
    Number(firstMatch(JSON.stringify(current), /"current_week":"?(\d+)/, "current week")) - 1;
  if (week < 1) {
    throw new Error("No week has finished yet; pass a week number to record it anyway");
  }
  const scoreboard = await fetchJson(
    `/league/${league};out=settings/scoreboard;week=${week}`,
    token
  );
  const matchup = matchupOf(scoreboard, team, week);
  const files = new Map<string, unknown>([
    ["current-scoreboard.json", current],
    [`week-${week}-scoreboard.json`, scoreboard],
  ]);
  const game = league.split(".")[0];
  const results = await runProbes(
    [
      ["game-weeks.json", `/game/${game}/game_weeks`],
      ["league-transactions.json", `/league/${league}/transactions`],
      ...teamProbes(league, team, "mine", matchup),
      ...teamProbes(league, matchup.opponent, "opponent", matchup),
    ],
    token,
    files
  );
  for (const [side, key] of [
    ["mine", team],
    ["opponent", matchup.opponent],
  ] as const) {
    const daily = matchup.dates.map((date) => files.get(`${side}-${date}-roster-stats.json`));
    const keys = movers(daily.filter((day) => day !== undefined));
    results.push(...(await runProbes(moverProbes(league, side, keys, matchup), token, files)));
    console.log(`${side} (${key}): ${keys.length} players moved during week ${week}`);
  }
  files.set("probes.json", {
    league,
    week,
    dates: matchup.dates,
    team,
    opponent: matchup.opponent,
    results,
  });
  return files;
}
