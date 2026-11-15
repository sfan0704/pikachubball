/**
 * The league shapes the Yahoo stand-in can serve. "standard" replays the
 * recorded 14-team, nine-category league. "12x10" serves the same league key
 * with the recorded 12-team, ten-category settings (3PT% for 3PTM, and PF),
 * so the browser tests can open Matchup and Players for a league that isn't
 * the standard nine. Its week tables are the recorded ones, cut to twelve
 * teams, with 3PT and PF made up deterministically from what was recorded.
 */

/** Which league the stand-in serves. */
export type StandInLeague = "standard" | "12x10";

/** The stand-in's league shapes. */
export const STAND_IN_LEAGUES: readonly StandInLeague[] = ["standard", "12x10"];

type Json = Record<string, unknown>;

/** The recorded responses the stand-in answers league requests with. */
export type LeagueFixtures = Record<"season" | "current" | "week", Json>;

const TEAMS = 12;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sections(response: Json): unknown[] {
  return (response.fantasy_content as Json).league as unknown[];
}

function settingsOf(response: Json): Json {
  const found = sections(response).find((section) => isJson(section) && "settings" in section);
  if (!isJson(found)) {
    throw new Error("stand-in: the 12x10 recording has no settings");
  }
  return found;
}

function teamKeyOf(entry: unknown): string {
  const team = (entry as { team: [Array<{ team_key?: string }>] }).team;
  return team[0].find((part) => part.team_key !== undefined)?.team_key ?? "";
}

function teamNumber(entry: unknown): number {
  return Number(/\.t\.(\d+)$/.exec(teamKeyOf(entry))?.[1]);
}

type Stat = { stat: { stat_id: string; value: string } };

/** A week's 3PT attempts and fouls, made up from the team's recorded threes and turnovers. */
function addTenCategoryStats(entry: unknown): void {
  const details = (entry as { team: [unknown, { team_stats: { stats: Stat[] } }] }).team[1];
  const stats = details.team_stats.stats;
  const value = (id: string) => Number(stats.find(({ stat }) => stat.stat_id === id)?.stat.value);
  const made = value("10");
  const attempts = Math.round(made * 2.8) + 1;
  stats.push(
    { stat: { stat_id: "9010009", value: `${made}/${attempts}` } },
    { stat: { stat_id: "11", value: (made / attempts).toFixed(3).replace(/^0/, "") } },
    { stat: { stat_id: "21", value: String(value("19") + teamNumber(entry) * 3) } }
  );
}

type Matchup = { matchup: { "0": { teams: Record<string, unknown> } } };

/** Twelve teams in six matchups: the recorded ones among teams 1–12, and the rest paired up. */
function twelveTeamMatchups(matchups: Record<string, unknown>): Record<string, unknown> {
  const recorded = Object.entries(matchups)
    .filter(([key]) => key !== "count")
    .map(([, matchup]) => matchup as Matchup);
  const teams = (matchup: Matchup) =>
    [matchup.matchup["0"].teams["0"], matchup.matchup["0"].teams["1"]] as const;
  const kept = recorded.filter((matchup) => teams(matchup).every((t) => teamNumber(t) <= TEAMS));
  const left = recorded
    .filter((matchup) => !kept.includes(matchup))
    .flatMap(teams)
    .filter((team) => teamNumber(team) <= TEAMS);
  if (left.length === 2) {
    const paired = copy(recorded.find((matchup) => !kept.includes(matchup)) as Matchup);
    paired.matchup["0"].teams = { "0": left[0], "1": left[1], count: 2 };
    kept.push(paired);
  }
  for (const matchup of kept) {
    teams(matchup).forEach(addTenCategoryStats);
  }
  return {
    ...Object.fromEntries(kept.map((matchup, index) => [String(index), matchup])),
    count: kept.length,
  };
}

/** A recorded week table served with the 12x10 settings and twelve teams. */
function tenCategoryWeek(week: Json, settings: Json): Json {
  const result = copy(week);
  const league = sections(result);
  for (const [index, section] of league.entries()) {
    if (isJson(section) && "settings" in section) {
      league[index] = copy(settings);
    }
    if (isJson(section) && isJson(section.scoreboard)) {
      const body = section.scoreboard["0"] as { matchups: Record<string, unknown> };
      body.matchups = twelveTeamMatchups(body.matchups);
    }
  }
  (league[0] as Json).num_teams = TEAMS;
  return result;
}

/** The 12x10 season table, relabelled as the standard league so the seeded users can open it. */
function tenCategorySeason(season: Json, standard: Json): Json {
  const text = JSON.stringify(season).replaceAll('"466.l.12', '"466.l.100000');
  const result = JSON.parse(text) as Json;
  const meta = sections(standard)[0] as Json;
  (sections(result)[0] as Json).name = meta.name;
  return result;
}

/** The fixtures for a league shape, from the standard recordings and the 12x10 season. */
export function leagueFixtures(
  league: StandInLeague,
  standard: LeagueFixtures,
  tenCategorySeasonResponse: Json
): LeagueFixtures {
  if (league === "standard") {
    return standard;
  }
  const settings = settingsOf(tenCategorySeasonResponse);
  return {
    season: tenCategorySeason(tenCategorySeasonResponse, standard.season),
    current: tenCategoryWeek(standard.current, settings),
    week: tenCategoryWeek(standard.week, settings),
  };
}
