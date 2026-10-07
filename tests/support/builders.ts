import type { CategoryStats, TeamStats } from '../../shared/domain';

/** Category totals with ordinary values; override only what a test cares about. */
export function buildCategoryStats(overrides: Partial<CategoryStats> = {}): CategoryStats {
  return {
    fgPct: 0.47,
    ftPct: 0.8,
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

/** One team's stats for a scope; makes and attempts match the percentages. */
export function buildTeamStats(overrides: Partial<TeamStats> = {}): TeamStats {
  const stats = buildCategoryStats(overrides.stats);
  return {
    teamKey: '466.l.1.t.1',
    teamName: 'Team 1',
    scope: 'week',
    week: 1,
    fgMakes: Math.round(stats.fgPct * 500),
    fgAttempts: 500,
    ftMakes: Math.round(stats.ftPct * 100),
    ftAttempts: 100,
    ...overrides,
    stats,
  };
}

/** A league of `count` teams with distinct keys and names. */
export function buildLeagueTeamStats(count: number, overrides: Partial<TeamStats> = {}): TeamStats[] {
  return Array.from({ length: count }, (_, index) =>
    buildTeamStats({
      teamKey: `466.l.1.t.${index + 1}`,
      teamName: `Team ${index + 1}`,
      ...overrides,
    }),
  );
}
