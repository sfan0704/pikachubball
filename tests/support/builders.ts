import type { LeagueCategory, LeagueSettings, TeamTable, TeamTotals } from "../../shared/domain";

const STANDARD_CATEGORIES: LeagueCategory[] = [
  { statId: "5", key: "fgPct", displayName: "FG%", direction: "higher" },
  { statId: "8", key: "ftPct", displayName: "FT%", direction: "higher" },
  { statId: "10", key: "tpm", displayName: "3PTM", direction: "higher" },
  { statId: "12", key: "pts", displayName: "PTS", direction: "higher" },
  { statId: "15", key: "reb", displayName: "REB", direction: "higher" },
  { statId: "16", key: "ast", displayName: "AST", direction: "higher" },
  { statId: "17", key: "stl", displayName: "ST", direction: "higher" },
  { statId: "18", key: "blk", displayName: "BLK", direction: "higher" },
  { statId: "19", key: "to", displayName: "TO", direction: "lower" },
];

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

/** Ordinary totals for one team; override only what a test cares about. */
export function buildTeamTotals(overrides: Partial<TeamTotals> = {}): TeamTotals {
  return {
    fgMakes: 235,
    fgAttempts: 500,
    ftMakes: 80,
    ftAttempts: 100,
    tpm: 60,
    pts: 550,
    reb: 220,
    ast: 130,
    stl: 40,
    blk: 25,
    to: 70,
    ...overrides,
  };
}

/** A team table whose rows get the given totals, in order. */
export function buildTeamTable(
  totals: Partial<TeamTotals>[],
  overrides: Partial<TeamTable> = {}
): TeamTable {
  return {
    scope: { kind: "week", week: 5 },
    settings: buildLeagueSettings(),
    teams: totals.map((teamTotals, index) => ({
      teamKey: `466.l.1.t.${index + 1}`,
      teamName: `Team ${index + 1}`,
      managerName: null,
      totals: buildTeamTotals(teamTotals),
    })),
    pairings: [],
    fetchedAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}
