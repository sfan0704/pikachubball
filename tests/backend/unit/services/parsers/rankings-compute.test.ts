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

    it('gives equal values the same competition rank regardless of input order', () => {
      const orders = [
        [['t.1', 10], ['t.2', 10], ['t.3', 5]],
        [['t.3', 5], ['t.2', 10], ['t.1', 10]],
        [['t.2', 10], ['t.3', 5], ['t.1', 10]],
      ] as const;

      for (const order of orders) {
        const result = computeCategoryRanks(
          order.map(([key, stl]) => createMockTeamStats(key, key, { stl })),
        );
        const ranks = Object.fromEntries(result.map(t => [t.teamKey, t.categoryRanks?.stl]));
        expect(ranks).toEqual({ 't.1': 1, 't.2': 1, 't.3': 3 });
      }
    });

    it('ranks turnovers ascending with ties sharing a rank', () => {
      const result = computeCategoryRanks([
        createMockTeamStats('t.1', 'A', { to: 5 }),
        createMockTeamStats('t.2', 'B', { to: 10 }),
        createMockTeamStats('t.3', 'C', { to: 5 }),
      ]);

      expect(result.map(t => t.categoryRanks?.to)).toEqual([1, 3, 1]);
    });

    it('compares percentages by makes/attempts instead of the rounded value', () => {
      // Yahoo reports both as .478; the exact rates are 0.47826 and 0.47843.
      const teams: TeamStats[] = [
        { ...createMockTeamStats('t.1', 'A', { fgPct: 0.478 }), fgMakes: 440, fgAttempts: 920 },
        { ...createMockTeamStats('t.2', 'B', { fgPct: 0.478 }), fgMakes: 445, fgAttempts: 930 },
      ];

      const result = computeCategoryRanks(teams);

      expect(result.map(t => t.categoryRanks?.fgPct)).toEqual([2, 1]);
    });

    it('ties identical shooting rates even when volumes differ', () => {
      const teams: TeamStats[] = [
        { ...createMockTeamStats('t.1', 'A', { ftPct: 0.75 }), ftMakes: 3, ftAttempts: 4 },
        { ...createMockTeamStats('t.2', 'B', { ftPct: 0.75 }), ftMakes: 75, ftAttempts: 100 },
      ];

      expect(computeCategoryRanks(teams).map(t => t.categoryRanks?.ftPct)).toEqual([1, 1]);
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
      expect(teamAlpha?.totalRank).toBeLessThan(teamBeta!.totalRank);
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
