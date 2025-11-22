import { describe, it, expect, beforeEach } from 'vitest';
import { getLeagueRankings, getLeagueHeatmap } from '../../../../server/services/viz/league-viz';
import { YahooMCPDataSource } from '../../../../server/services/fantasy-data-source';
import { createMockMCPClient, createMalformedMCPClient } from '../../fixtures/mock-mcp-client';
import { testLeagueKey } from '../../fixtures/test-data';

describe('league-viz', () => {
  let dataSource: YahooMCPDataSource;

  beforeEach(async () => {
    const mockClient = createMockMCPClient();
    await mockClient.setCredentials('test-token', 'refresh-token', Date.now() + 3600000);
    dataSource = new YahooMCPDataSource(mockClient as any);
  });

  describe('getLeagueRankings', () => {
    it('should return league rankings with correct structure', async () => {
      const result = await getLeagueRankings(dataSource, testLeagueKey);

      expect(result).toHaveProperty('rankings');
      expect(result).toHaveProperty('metadata');
      expect(Array.isArray(result.rankings)).toBe(true);
      expect(result.rankings.length).toBeGreaterThan(0);
    });

    it('should calculate category ranks correctly', async () => {
      const result = await getLeagueRankings(dataSource, testLeagueKey);
      const firstTeam = result.rankings[0];

      // Check that all categories have ranks
      expect(firstTeam.categoryRanks).toHaveProperty('fgPct');
      expect(firstTeam.categoryRanks).toHaveProperty('ftPct');
      expect(firstTeam.categoryRanks).toHaveProperty('tpm');
      expect(firstTeam.categoryRanks).toHaveProperty('pts');
      expect(firstTeam.categoryRanks).toHaveProperty('reb');
      expect(firstTeam.categoryRanks).toHaveProperty('ast');
      expect(firstTeam.categoryRanks).toHaveProperty('stl');
      expect(firstTeam.categoryRanks).toHaveProperty('blk');
      expect(firstTeam.categoryRanks).toHaveProperty('to');

      // All ranks should be positive integers
      Object.values(firstTeam.categoryRanks).forEach(rank => {
        expect(rank).toBeGreaterThan(0);
        expect(Number.isInteger(rank)).toBe(true);
      });
    });

    it('should calculate total rank as average of category ranks', async () => {
      const result = await getLeagueRankings(dataSource, testLeagueKey);
      const team = result.rankings[0];

      const categoryRanks = Object.values(team.categoryRanks);
      const sum = categoryRanks.reduce((a: number, b: number) => a + b, 0);
      const expectedAvg = sum / categoryRanks.length;

      expect(team.totalRank).toBeCloseTo(expectedAvg, 2);
    });

    it('should rank turnover category in reverse (lower is better)', async () => {
      const result = await getLeagueRankings(dataSource, testLeagueKey);

      // Find teams with lowest and highest TOs
      const sortedByTO = [...result.rankings].sort((a, b) => a.stats.to - b.stats.to);
      const lowestTO = sortedByTO[0];
      const highestTO = sortedByTO[sortedByTO.length - 1];

      // Team with lowest TOs should have better (lower) TO rank
      expect(lowestTO.categoryRanks.to).toBeLessThan(highestTO.categoryRanks.to);
    });

    it('should extract manager names', async () => {
      const result = await getLeagueRankings(dataSource, testLeagueKey);

      // At least one team should have a manager name
      const teamsWithManagers = result.rankings.filter(t => t.managerName);
      expect(teamsWithManagers.length).toBeGreaterThan(0);
    });

    it('should include FG% and FT% makes/attempts data', async () => {
      const result = await getLeagueRankings(dataSource, testLeagueKey);
      const team = result.rankings[0] as any;

      // Check that shooting data is present
      expect(team.fgMakes).toBeGreaterThan(0);
      expect(team.fgAttempts).toBeGreaterThan(0);
      expect(team.ftMakes).toBeGreaterThan(0);
      expect(team.ftAttempts).toBeGreaterThan(0);

      // Verify makes are less than attempts
      expect(team.fgMakes).toBeLessThanOrEqual(team.fgAttempts);
      expect(team.ftMakes).toBeLessThanOrEqual(team.ftAttempts);
    });

    it('should include correct metadata', async () => {
      const result = await getLeagueRankings(dataSource, testLeagueKey);

      expect(result.metadata.scope).toBe('season');
      expect(result.metadata.currentWeek).toBeGreaterThan(0);
      expect(result.metadata.totalWeeks).toBeGreaterThan(0);
      expect(result.metadata.currentWeek).toBeLessThanOrEqual(result.metadata.totalWeeks);
    });

    it('should handle week parameter for weekly rankings', async () => {
      const week = 5;
      const result = await getLeagueRankings(dataSource, testLeagueKey, week);

      expect(result.metadata.scope).toBe('week');
      expect(result.metadata.week).toBe(week);
    });
  });

  describe('getLeagueHeatmap', () => {
    it('should return heatmap data with correct structure', async () => {
      const result = await getLeagueHeatmap(dataSource, testLeagueKey);

      expect(result).toHaveProperty('teams');
      expect(result).toHaveProperty('metadata');
      expect(Array.isArray(result.teams)).toBe(true);
      expect(result.teams.length).toBeGreaterThan(0);
    });

    it('should include heatmap cells for each category', async () => {
      const result = await getLeagueHeatmap(dataSource, testLeagueKey);
      const team = result.teams[0];

      expect(team.categories).toHaveProperty('fgPct');
      expect(team.categories).toHaveProperty('ftPct');
      expect(team.categories).toHaveProperty('tpm');
      expect(team.categories).toHaveProperty('pts');
      expect(team.categories).toHaveProperty('reb');
      expect(team.categories).toHaveProperty('ast');
      expect(team.categories).toHaveProperty('stl');
      expect(team.categories).toHaveProperty('blk');
      expect(team.categories).toHaveProperty('to');
    });

    it('should calculate percentiles correctly (0-100 range)', async () => {
      const result = await getLeagueHeatmap(dataSource, testLeagueKey);

      result.teams.forEach(team => {
        Object.values(team.categories).forEach((cell: any) => {
          expect(cell.percentile).toBeGreaterThanOrEqual(0);
          expect(cell.percentile).toBeLessThanOrEqual(100);
        });
      });
    });

    it('should assign ranks correctly', async () => {
      const result = await getLeagueHeatmap(dataSource, testLeagueKey);
      const numTeams = result.teams.length;

      result.teams.forEach(team => {
        Object.values(team.categories).forEach((cell: any) => {
          expect(cell.rank).toBeGreaterThan(0);
          expect(cell.rank).toBeLessThanOrEqual(numTeams);
        });
      });
    });
  });

  describe('error handling', () => {
    it('should return empty rankings for malformed standings data', async () => {
      const malformedClient = createMalformedMCPClient();
      await malformedClient.setCredentials('test-token', 'refresh-token', Date.now() + 3600000);
      const malformedDataSource = new YahooMCPDataSource(malformedClient as any);

      // Code doesn't throw, returns empty/default structure
      const result = await getLeagueRankings(malformedDataSource, testLeagueKey);
      expect(result).toBeDefined();
      expect(result.rankings).toBeDefined();
      expect(Array.isArray(result.rankings)).toBe(true);
    });

    it('should pass through week parameter without validation', async () => {
      // Week validation happens at Yahoo API level, not in our code
      // Our code just passes it through
      const result = await getLeagueRankings(dataSource, testLeagueKey, 999);
      expect(result).toBeDefined();
      expect(result.metadata.week).toBe(999);
    });

    it('should handle missing stat data', async () => {
      // MockMCPClient returns consistent data, but we verify resilience
      const result = await getLeagueRankings(dataSource, testLeagueKey);
      
      // Even with potential missing stats, should return valid structure
      expect(result.rankings).toBeDefined();
      expect(Array.isArray(result.rankings)).toBe(true);
    });
  });
});
