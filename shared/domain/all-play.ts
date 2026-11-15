/**
 * League maths for the season story: all-play, official week records,
 * win-% ranks and luck. Every function takes the league's own category list
 * (id and direction), so a league can have any number of teams and categories.
 */
import { competitionRanks } from "./fantasy-rules";
import type { LeagueCategory, MatchupPairing, TeamRecord } from "./team-table";

/** What the maths needs from a league category: its id and which way wins. */
export type ScoringCategory = Pick<LeagueCategory, "statId" | "direction">;

/**
 * One team's values for one week, keyed by category stat id. An absent or
 * null value is unknown, never zero. Ratio categories (FG%, FT%) must already
 * be total makes over total attempts.
 */
export interface TeamCategoryValues {
  readonly teamKey: string;
  readonly values: Readonly<Record<string, number | null | undefined>>;
}

/** A team's all-play record: the total, and one record per category stat id. */
export interface AllPlayRecord {
  readonly total: TeamRecord;
  readonly byCategory: Readonly<Record<string, TeamRecord>>;
}

/** Each team's all-play record, keyed by team key. */
export type AllPlayTable = Readonly<Record<string, AllPlayRecord>>;

/** The steps of a team's luck, kept apart so the team sheet can show each one. */
export interface LuckSteps {
  /** Official category wins, a tie counting as half. */
  readonly realWins: number;
  /** All-play win % times the categories that had an official result. */
  readonly expectedWins: number;
  /** Real wins minus expected wins: positive means luckier than the team's strength. */
  readonly luck: number;
}

type Result = "win" | "loss" | "tie";

const EMPTY_RECORD: TeamRecord = { wins: 0, losses: 0, ties: 0 };

function valueOf(team: TeamCategoryValues, statId: string): number | null {
  const value = team.values[statId];
  return value === undefined || value === null || !Number.isFinite(value) ? null : value;
}

/** One category between two teams; null when either value is unknown, so no result is claimed. */
function categoryResult(
  mine: TeamCategoryValues,
  theirs: TeamCategoryValues,
  category: ScoringCategory
): Result | null {
  const a = valueOf(mine, category.statId);
  const b = valueOf(theirs, category.statId);
  if (a === null || b === null) {
    return null;
  }
  if (a === b) {
    return "tie";
  }
  return a > b === (category.direction === "higher") ? "win" : "loss";
}

function addResult(record: TeamRecord, result: Result): TeamRecord {
  return {
    wins: record.wins + (result === "win" ? 1 : 0),
    losses: record.losses + (result === "loss" ? 1 : 0),
    ties: record.ties + (result === "tie" ? 1 : 0),
  };
}

/** Two records added together. */
export function addRecords(a: TeamRecord, b: TeamRecord): TeamRecord {
  return { wins: a.wins + b.wins, losses: a.losses + b.losses, ties: a.ties + b.ties };
}

/** My team against one opponent, category by category, as an all-play record. */
function headToHead(
  mine: TeamCategoryValues,
  theirs: TeamCategoryValues,
  categories: readonly ScoringCategory[]
): AllPlayRecord {
  let total = EMPTY_RECORD;
  const byCategory: Record<string, TeamRecord> = {};
  for (const category of categories) {
    const result = categoryResult(mine, theirs, category);
    byCategory[category.statId] = result === null ? EMPTY_RECORD : addResult(EMPTY_RECORD, result);
    if (result !== null) {
      total = addResult(total, result);
    }
  }
  return { total, byCategory };
}

function emptyAllPlay(categories: readonly ScoringCategory[]): AllPlayRecord {
  return {
    total: EMPTY_RECORD,
    byCategory: Object.fromEntries(categories.map((category) => [category.statId, EMPTY_RECORD])),
  };
}

function addAllPlay(a: AllPlayRecord, b: AllPlayRecord): AllPlayRecord {
  const byCategory: Record<string, TeamRecord> = { ...a.byCategory };
  for (const [statId, record] of Object.entries(b.byCategory)) {
    byCategory[statId] = addRecords(byCategory[statId] ?? EMPTY_RECORD, record);
  }
  return { total: addRecords(a.total, b.total), byCategory };
}

/**
 * One week's all-play: every team against every other team in every
 * category. A category with an unknown value on either side has no result.
 */
export function weeklyAllPlay(
  categories: readonly ScoringCategory[],
  teams: readonly TeamCategoryValues[]
): AllPlayTable {
  const table: Record<string, AllPlayRecord> = {};
  for (const team of teams) {
    let record = emptyAllPlay(categories);
    for (const opponent of teams) {
      if (opponent.teamKey !== team.teamKey) {
        record = addAllPlay(record, headToHead(team, opponent, categories));
      }
    }
    table[team.teamKey] = record;
  }
  return table;
}

/**
 * Season all-play (method A): the weekly records added up. Each week is a
 * fresh matchup, so margins never carry over; a team missing from a week adds nothing.
 */
export function seasonAllPlay(weeks: readonly AllPlayTable[]): AllPlayTable {
  const season: Record<string, AllPlayRecord> = {};
  for (const week of weeks) {
    for (const [teamKey, record] of Object.entries(week)) {
      season[teamKey] = teamKey in season ? addAllPlay(season[teamKey], record) : record;
    }
  }
  return season;
}

/**
 * Each team's category W–L–T against its real opponent in one week, from
 * that week's pairings. Teams without a pairing (a bye) are left out.
 */
export function officialWeekRecords(
  categories: readonly ScoringCategory[],
  teams: readonly TeamCategoryValues[],
  pairings: readonly MatchupPairing[]
): Readonly<Record<string, TeamRecord>> {
  const byKey = new Map(teams.map((team) => [team.teamKey, team]));
  const records: Record<string, TeamRecord> = {};
  for (const pairing of pairings) {
    const [first, second] = pairing.teamKeys.map((key) => byKey.get(key));
    if (first === undefined || second === undefined) {
      continue;
    }
    records[first.teamKey] = headToHead(first, second, categories).total;
    records[second.teamKey] = headToHead(second, first, categories).total;
  }
  return records;
}

/** Results a record counts: wins, losses and ties. */
export function resultsPlayed(record: TeamRecord): number {
  return record.wins + record.losses + record.ties;
}

/** Wins over results, a tie counting as half a win; null with no results. */
export function winPercentage(record: TeamRecord): number | null {
  const played = resultsPlayed(record);
  return played === 0 ? null : (record.wins + record.ties / 2) / played;
}

/**
 * Competition ranks (1, 1, 3) by win %, best first, keyed by team key. A team
 * with no results gets no rank and doesn't affect the others.
 */
export function winPercentageRanks(
  records: Readonly<Record<string, TeamRecord>>
): Readonly<Record<string, number | null>> {
  const entries = Object.entries(records);
  const ranks = competitionRanks(
    entries.map(([, record]) => winPercentage(record)),
    "higher"
  );
  return Object.fromEntries(entries.map(([teamKey], index) => [teamKey, ranks[index]]));
}

/**
 * Luck: real wins (official wins plus half the ties) minus expected wins
 * (all-play win % times the categories that had an official result). Null
 * when the team has no all-play results to judge its strength by.
 */
export function luckSteps(official: TeamRecord, allPlay: TeamRecord): LuckSteps | null {
  const strength = winPercentage(allPlay);
  if (strength === null) {
    return null;
  }
  const realWins = official.wins + official.ties / 2;
  const expectedWins = strength * resultsPlayed(official);
  return { realWins, expectedWins, luck: realWins - expectedWins };
}
