/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { computeCategoryRanks, computeTotalRanks, computeRankings } from '../../../../../server/services/parsers/rankings-compute';
import type { TeamStats } from '@shared/domain';

describe('rankings-compute', () => {
  const createMockTeamStats = (
    teamKey: string,
    teamName: string,
    stats: Partial<Record<string, number>>
  ): TeamStats => {
    const defaultStats = {
      fgp: 0,
      ftp: 0,
      fgm: 0,
      ftm: 0,
      tpm: 0,
      pts: 0,
      reb: 0,
      ast: 0,
      st: 0,
      blk: 0,
      to: 0,
    };
    return {
      teamKey,
      teamName,
      stats: { ...defaultStats, ...stats },
    };
  };

  describe('computeCategoryRanks', () => {
    it('should compute category ranks correctly', () => {
      // ARRANGE
      const teamStats: TeamStats[] = [
        createMockTeamStats('t.1', 'Team Alpha', { pts: 1000, reb: 500, ast: 300, to: 100 }),
        createMockTeamStats('t.2', 'Team Beta', { pts: 900, reb: 450, ast: 250, to: 120 }),
        createMockTeamStats('t.3', 'Team Gamma', { pts: 1100, reb: 550, ast: 350, to: 80 }),
      ];

      // ACT
      const result = computeCategoryRanks(teamStats);

      // ASSERT
      expect(result).toHaveLength(3);
      
      // PTS: Team Gamma (1st), Team Alpha (2nd), Team Beta (3rd)
      expect(result.find(t => t.teamKey === 't.3')?.categoryRanks?.pts).toBe(1);
      expect(result.find(t => t.teamKey === 't.1')?.categoryRanks?.pts).toBe(2);
      expect(result.find(t => t.teamKey === 't.2')?.categoryRanks?.pts).toBe(3);
      
      // TO (turnovers): lower is better, so Team Gamma (1st), Team Alpha (2nd), Team Beta (3rd)
      expect(result.find(t => t.teamKey === 't.3')?.categoryRanks?.to).toBe(1);
      expect(result.find(t => t.teamKey === 't.1')?.categoryRanks?.to).toBe(2);
      expect(result.find(t => t.teamKey === 't.2')?.categoryRanks?.to).toBe(3);
    });

    it('should handle turnovers correctly (lower is better)', () => {
      // ARRANGE
      const teamStats: TeamStats[] = [
        createMockTeamStats('t.1', 'Team Alpha', { to: 100 }),
        createMockTeamStats('t.2', 'Team Beta', { to: 80 }),
        createMockTeamStats('t.3', 'Team Gamma', { to: 120 }),
      ];

      // ACT
      const result = computeCategoryRanks(teamStats);

      // ASSERT
      // Lower turnovers = better rank
      expect(result.find(t => t.teamKey === 't.2')?.categoryRanks?.to).toBe(1);
      expect(result.find(t => t.teamKey === 't.1')?.categoryRanks?.to).toBe(2);
      expect(result.find(t => t.teamKey === 't.3')?.categoryRanks?.to).toBe(3);
    });

    it('should handle empty array', () => {
      // ARRANGE
      const teamStats: TeamStats[] = [];

      // ACT
      const result = computeCategoryRanks(teamStats);

      // ASSERT
      expect(result).toEqual([]);
    });

    it('should handle single team', () => {
      // ARRANGE
      const teamStats: TeamStats[] = [
        createMockTeamStats('t.1', 'Team Alpha', { pts: 1000 }),
      ];

      // ACT
      const result = computeCategoryRanks(teamStats);

      // ASSERT
      expect(result).toHaveLength(1);
      expect(result[0].categoryRanks?.pts).toBe(1);
    });

    it('should handle ties correctly', () => {
      // ARRANGE
      const teamStats: TeamStats[] = [
        createMockTeamStats('t.1', 'Team Alpha', { pts: 1000 }),
        createMockTeamStats('t.2', 'Team Beta', { pts: 1000 }),
        createMockTeamStats('t.3', 'Team Gamma', { pts: 900 }),
      ];

      // ACT
      const result = computeCategoryRanks(teamStats);

      // ASSERT
      // Both teams with 1000 pts should get ranks 1 and 2 (order depends on sort stability)
      const ranks = result.map(t => t.categoryRanks?.pts).sort((a, b) => a! - b!);
      expect(ranks).toEqual([1, 2, 3]);
    });
  });

  describe('computeTotalRanks', () => {
    it('should compute total rank as sum of category ranks', () => {
      // ARRANGE
      const teamStats: TeamStats[] = [
        createMockTeamStats('t.1', 'Team Alpha', { pts: 1000, reb: 500 }),
        createMockTeamStats('t.2', 'Team Beta', { pts: 900, reb: 450 }),
      ];
      const withCategoryRanks = computeCategoryRanks(teamStats);

      // ACT
      const result = computeTotalRanks(withCategoryRanks);

      // ASSERT
      expect(result).toHaveLength(2);
      expect(result[0].totalRank).toBeGreaterThan(0);
      expect(result[1].totalRank).toBeGreaterThan(0);
      
      // Team Alpha should have lower total rank (better) since it has higher stats
      const teamAlpha = result.find(t => t.teamKey === 't.1');
      const teamBeta = result.find(t => t.teamKey === 't.2');
      expect(teamAlpha?.totalRank).toBeLessThan(teamBeta?.totalRank!);
    });

    it('should handle teams without categoryRanks', () => {
      // ARRANGE
      const teamStats: TeamStats[] = [
        { teamKey: 't.1', teamName: 'Team Alpha', stats: { pts: 1000 } as any },
      ];

      // ACT
      const result = computeTotalRanks(teamStats);

      // ASSERT
      expect(result[0].totalRank).toBe(0);
    });

    it('should handle empty array', () => {
      // ARRANGE
      const teamStats: TeamStats[] = [];

      // ACT
      const result = computeTotalRanks(teamStats);

      // ASSERT
      expect(result).toEqual([]);
    });
  });

  describe('computeRankings', () => {
    it('should compute both category ranks and total rank', () => {
      // ARRANGE
      const teamStats: TeamStats[] = [
        createMockTeamStats('t.1', 'Team Alpha', { pts: 1000, reb: 500 }),
        createMockTeamStats('t.2', 'Team Beta', { pts: 900, reb: 450 }),
        createMockTeamStats('t.3', 'Team Gamma', { pts: 1100, reb: 550 }),
      ];

      // ACT
      const result = computeRankings(teamStats);

      // ASSERT
      expect(result).toHaveLength(3);
      
      // All teams should have categoryRanks
      result.forEach(team => {
        expect(team.categoryRanks).toBeDefined();
        expect(team.totalRank).toBeDefined();
        expect(team.totalRank).toBeGreaterThan(0);
      });
      
      // Verify all teams have valid ranks
      result.forEach(team => {
        expect(team.categoryRanks).toBeDefined();
        expect(team.totalRank).toBeDefined();
        expect(team.totalRank).toBeGreaterThan(0);
      });
      
      // Verify rankings are computed (sum of category ranks)
      const teamGamma = result.find(t => t.teamKey === 't.3');
      const teamAlpha = result.find(t => t.teamKey === 't.1');
      const teamBeta = result.find(t => t.teamKey === 't.2');
      
      // All teams should have rankings
      expect(teamGamma?.totalRank).toBeGreaterThan(0);
      expect(teamAlpha?.totalRank).toBeGreaterThan(0);
      expect(teamBeta?.totalRank).toBeGreaterThan(0);
    });

    it('should preserve original team data', () => {
      // ARRANGE
      const teamStats: TeamStats[] = [
        createMockTeamStats('t.1', 'Team Alpha', { pts: 1000 }),
      ];

      // ACT
      const result = computeRankings(teamStats);

      // ASSERT
      expect(result[0].teamKey).toBe('t.1');
      expect(result[0].teamName).toBe('Team Alpha');
      expect(result[0].stats.pts).toBe(1000);
    });
  });
});
