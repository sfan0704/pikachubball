/**
 * Rankings Computation Functions
 * Compute category ranks and total ranks from team stats
 */

import type { TeamStats, CategoryKey } from '../../../shared/domain/index.js';
import { CATEGORIES } from '../../../shared/domain/index.js';

/**
 * Value used to compare a category. Yahoo reports percentages rounded to three
 * decimals, so FG% and FT% compare exact makes/attempts when attempts are known.
 */
export function comparableValue(team: TeamStats, cat: CategoryKey): number {
  if (cat === 'fgPct' && team.fgAttempts) {
    return (team.fgMakes ?? 0) / team.fgAttempts;
  }
  if (cat === 'ftPct' && team.ftAttempts) {
    return (team.ftMakes ?? 0) / team.ftAttempts;
  }
  return team.stats[cat];
}

/**
 * Compares two teams in a category: positive when `a` is better. Turnovers are
 * better when lower; every other category is better when higher.
 */
export function compareCategory(a: TeamStats, b: TeamStats, cat: CategoryKey): number {
  const difference = comparableValue(a, cat) - comparableValue(b, cat);
  return cat === 'to' ? -difference : difference;
}

/**
 * Compute category ranks for all teams using competition ranking: equal
 * values share a rank and the next rank skips (1, 1, 3), whatever the input order.
 * @param teamStats Array of team stats
 * @returns Array of team stats with categoryRanks populated
 */
export function computeCategoryRanks(teamStats: TeamStats[]): TeamStats[] {
  return teamStats.map(team => {
    const categoryRanks = {} as Record<CategoryKey, number>;
    CATEGORIES.forEach(cat => {
      const better = teamStats.filter(other => compareCategory(other, team, cat) > 0).length;
      categoryRanks[cat] = better + 1;
    });
    return { ...team, categoryRanks };
  });
}

/**
 * Compute total rank (sum of category ranks, lower is better)
 * @param teamStats Array of team stats with categoryRanks populated
 * @returns Array of team stats with totalRank populated
 */
export function computeTotalRanks(teamStats: TeamStats[]): TeamStats[] {
  return teamStats.map(team => {
    if (!team.categoryRanks) {
      return { ...team, totalRank: 0 };
    }

    const totalRank = CATEGORIES.reduce((sum, cat) => {
      return sum + (team.categoryRanks![cat] || 0);
    }, 0);

    return {
      ...team,
      totalRank,
    };
  });
}

/**
 * Compute all rankings (category ranks + total rank)
 * @param teamStats Array of team stats
 * @returns Array of team stats with categoryRanks and totalRank populated
 */
export function computeRankings(teamStats: TeamStats[]): TeamStats[] {
  const withCategoryRanks = computeCategoryRanks(teamStats);
  return computeTotalRanks(withCategoryRanks);
}
