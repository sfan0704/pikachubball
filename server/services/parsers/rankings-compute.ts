/**
 * Rankings Computation Functions
 * Compute category ranks and total ranks from team stats
 */

import type { TeamStats, CategoryKey } from '@shared/domain';
import { CATEGORIES } from '@shared/domain';

/**
 * Compute category ranks for all teams
 * @param teamStats Array of team stats
 * @returns Array of team stats with categoryRanks populated
 */
export function computeCategoryRanks(teamStats: TeamStats[]): TeamStats[] {
  const rankings = teamStats.map(team => ({
    ...team,
    categoryRanks: {} as Record<CategoryKey, number>,
  }));

  CATEGORIES.forEach(cat => {
    // Sort teams by category value
    // For turnovers (to), lower is better; for others, higher is better
    const sorted = [...teamStats].sort((a, b) => {
      if (cat === 'to') {
        return a.stats[cat] - b.stats[cat];
      } else {
        return b.stats[cat] - a.stats[cat];
      }
    });

    // Assign ranks (1-based)
    sorted.forEach((team, index) => {
      const rankingTeam = rankings.find(r => r.teamKey === team.teamKey);
      if (rankingTeam) {
        rankingTeam.categoryRanks![cat] = index + 1;
      }
    });
  });

  return rankings;
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

