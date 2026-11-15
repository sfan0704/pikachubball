import {
  lineOf,
  measured,
  percentage,
  type CategoryValues,
  type CountValue,
  type LeagueCategory,
  type LeagueSettings,
  type StatLine,
  type TeamTable,
} from "../../shared/domain";

/** Yahoo's NBA stat ids by a readable name, for building lines and totals in tests. */
export const STAT = {
  fga: "3",
  fgm: "4",
  fgPct: "5",
  fta: "6",
  ftm: "7",
  ftPct: "8",
  tpa: "9",
  tpm: "10",
  tpPct: "11",
  pts: "12",
  reb: "15",
  ast: "16",
  stl: "17",
  blk: "18",
  to: "19",
  astTo: "20",
  pf: "21",
  mpg: "26",
} as const;

/** A readable stat name. */
export type StatName = keyof typeof STAT;

const COUNTING = { kind: "counting" } as const;

function ratio(top: StatName, bottom: StatName) {
  return { kind: "ratio", topStatId: STAT[top], bottomStatId: STAT[bottom] } as const;
}

/** League categories by readable name, shaped as the league settings parser builds them. */
export const CATEGORY: Readonly<Record<string, LeagueCategory>> = {
  fgPct: { statId: "5", displayName: "FG%", direction: "higher", makeup: ratio("fgm", "fga") },
  ftPct: { statId: "8", displayName: "FT%", direction: "higher", makeup: ratio("ftm", "fta") },
  tpPct: { statId: "11", displayName: "3PT%", direction: "higher", makeup: ratio("tpm", "tpa") },
  tpm: { statId: "10", displayName: "3PTM", direction: "higher", makeup: COUNTING },
  pts: { statId: "12", displayName: "PTS", direction: "higher", makeup: COUNTING },
  reb: { statId: "15", displayName: "REB", direction: "higher", makeup: COUNTING },
  ast: { statId: "16", displayName: "AST", direction: "higher", makeup: COUNTING },
  stl: { statId: "17", displayName: "ST", direction: "higher", makeup: COUNTING },
  blk: { statId: "18", displayName: "BLK", direction: "higher", makeup: COUNTING },
  to: { statId: "19", displayName: "TO", direction: "lower", makeup: COUNTING },
  astTo: { statId: "20", displayName: "A/T", direction: "higher", makeup: ratio("ast", "to") },
  pf: { statId: "21", displayName: "PF", direction: "lower", makeup: COUNTING },
  mpg: { statId: "26", displayName: "MPG", direction: "higher", makeup: { kind: "unavailable" } },
};

/** The standard nine categories. */
export const STANDARD_CATEGORIES: readonly LeagueCategory[] = [
  "fgPct",
  "ftPct",
  "tpm",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "to",
].map((name) => CATEGORY[name]);

/** The ten categories of the 12-team fixture league: 3PT% for 3PTM, and PF. */
export const TEN_CATEGORIES: readonly LeagueCategory[] = [
  "fgPct",
  "ftPct",
  "tpPct",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "to",
  "pf",
].map((name) => CATEGORY[name]);

/** The eight categories of the 8-team fixture league: no FT% or TO, and A/T. */
export const EIGHT_CATEGORIES: readonly LeagueCategory[] = [
  "fgPct",
  "tpm",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "astTo",
].map((name) => CATEGORY[name]);

/** League settings for a standard nine-category head-to-head league. */
export function buildLeagueSettings(overrides: Partial<LeagueSettings> = {}): LeagueSettings {
  return {
    leagueKey: "466.l.1",
    name: "Test League",
    season: 2026,
    scoringType: "head",
    categories: STANDARD_CATEGORIES,
    startWeek: 1,
    endWeek: 20,
    currentWeek: 5,
    isFinished: false,
    ...overrides,
  };
}

/** Ordinary week totals for one team by stat name; null is unknown. */
export type TestTotals = Partial<Record<StatName, number | null>>;

const ORDINARY_TOTALS: TestTotals = {
  fgm: 235,
  fga: 500,
  ftm: 80,
  fta: 100,
  tpm: 60,
  tpa: 160,
  pts: 550,
  reb: 220,
  ast: 130,
  stl: 40,
  blk: 25,
  to: 70,
  pf: 90,
};

/** A team's summed stats by stat id; override only what a test cares about. */
export function buildStatTotals(overrides: TestTotals = {}): Record<string, number | null> {
  const merged = { ...ORDINARY_TOTALS, ...overrides };
  return Object.fromEntries(
    Object.entries(merged).map(([name, value]) => [STAT[name as StatName], value ?? null])
  );
}

/** Each category's value from test totals, the way the app's own sums would give them. */
export function buildCategoryValues(
  overrides: TestTotals = {},
  categories: readonly LeagueCategory[] = STANDARD_CATEGORIES
): CategoryValues {
  const totals = buildStatTotals(overrides);
  return Object.fromEntries(
    categories.map((category) => {
      const makeup = category.makeup;
      const value =
        makeup.kind === "ratio"
          ? percentage(totals[makeup.topStatId] ?? null, totals[makeup.bottomStatId] ?? null)
          : makeup.kind === "counting"
            ? (totals[category.statId] ?? null)
            : 12.5; // Yahoo's own value for a category the app can't build
      return [category.statId, value];
    })
  );
}

/** A team table whose rows get the given totals, in order. */
export function buildTeamTable(
  totals: TestTotals[],
  overrides: Partial<TeamTable> = {}
): TeamTable {
  const settings = overrides.settings ?? buildLeagueSettings();
  return {
    scope: { kind: "week", week: 5 },
    settings,
    teams: totals.map((teamTotals, index) => ({
      teamKey: `466.l.1.t.${index + 1}`,
      teamName: `Team ${index + 1}`,
      managerName: null,
      games: null,
      record: null,
      categoryValues: buildCategoryValues(teamTotals, settings.categories),
    })),
    pairings: [],
    fetchedAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

/** One game's stats by name; a number is measured, a value object is used as is. */
export type TestLine = Partial<Record<StatName, number | CountValue>>;

const ORDINARY_LINE: TestLine = {
  fgm: 6,
  fga: 13,
  ftm: 3,
  fta: 4,
  tpm: 2,
  tpa: 5,
  pts: 17,
  reb: 5,
  ast: 4,
  stl: 1,
  blk: 0,
  to: 2,
  pf: 3,
};

/** An ordinary measured stat line for one game; override only what a test cares about. */
export function buildStatLine(overrides: TestLine = {}): StatLine {
  const merged = { ...ORDINARY_LINE, ...overrides };
  return lineOf(
    Object.fromEntries(
      Object.entries(merged).map(([name, value]) => [
        STAT[name as StatName],
        typeof value === "number" ? measured(value) : value,
      ])
    )
  );
}
