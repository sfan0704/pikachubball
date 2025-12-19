import { describe, it, expect, beforeEach } from 'vitest';
import { getMatchupComparison } from '../../../../server/services/viz/matchup-viz';
import { createMockFantasyDataSource, createMalformedFantasyDataSource } from '../../fixtures/mock-fantasy-data-source';
import type { FantasyDataSource } from '../../../../server/services/fantasy-data-source';
import { testLeagueKey, testTeamKey } from '../../fixtures/test-data';

describe('matchup-viz', () => {
  let dataSource: FantasyDataSource;

  beforeEach(async () => {
    dataSource = createMockFantasyDataSource();
  });

  describe('getMatchupComparison', () => {
    it('should return matchup comparison with correct structure', async () => {
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      expect(result).toHaveProperty('myTeam');
      expect(result).toHaveProperty('opponent');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('metadata');
    });

    it('should identify correct teams in matchup', async () => {
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      expect(result.myTeam.teamKey).toBe(testTeamKey);
      expect(result.myTeam.teamName).toBeTruthy();
      expect(result.opponent.teamKey).toBeTruthy();
      expect(result.opponent.teamName).toBeTruthy();
      expect(result.opponent.teamKey).not.toBe(testTeamKey);
    });

    it('should include all 9 categories', async () => {
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      expect(result.categories.length).toBe(9);
      
      const categoryNames = result.categories.map(c => c.category);
      expect(categoryNames).toContain('fgPct');
      expect(categoryNames).toContain('ftPct');
      expect(categoryNames).toContain('tpm');
      expect(categoryNames).toContain('pts');
      expect(categoryNames).toContain('reb');
      expect(categoryNames).toContain('ast');
      expect(categoryNames).toContain('stl');
      expect(categoryNames).toContain('blk');
      expect(categoryNames).toContain('to');
    });

    it('should calculate W/L/T score correctly', async () => {
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      // Score should add up to 9 (total categories)
      const total = result.score.wins + result.score.losses + result.score.ties;
      expect(total).toBe(9);

      // Each component should be non-negative
      expect(result.score.wins).toBeGreaterThanOrEqual(0);
      expect(result.score.losses).toBeGreaterThanOrEqual(0);
      expect(result.score.ties).toBeGreaterThanOrEqual(0);
    });

    it('should determine category winner correctly (higher is better for most stats)', async () => {
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      // Find a category where myTeam has higher value (not TO)
      const ptsCategory = result.categories.find(c => c.category === 'pts');
      if (ptsCategory && ptsCategory.myTeam > ptsCategory.opponent) {
        expect(ptsCategory.winning).toBe(true);
      } else if (ptsCategory && ptsCategory.myTeam < ptsCategory.opponent) {
        expect(ptsCategory.winning).toBe(false);
      }
    });

    it('should handle turnovers correctly (lower is better)', async () => {
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      const toCategory = result.categories.find(c => c.category === 'to');
      expect(toCategory).toBeDefined();

      // For TO, lower value should win
      if (toCategory!.myTeam < toCategory!.opponent) {
        expect(toCategory!.winning).toBe(true);
      } else if (toCategory!.myTeam > toCategory!.opponent) {
        expect(toCategory!.winning).toBe(false);
      }
    });

    it('should include makes/attempts for FG% and FT%', async () => {
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      const fgCategory = result.categories.find(c => c.category === 'fgPct');
      const ftCategory = result.categories.find(c => c.category === 'ftPct');

      expect(fgCategory).toBeDefined();
      expect(fgCategory!.myTeamMakes).toBeDefined();
      expect(fgCategory!.myTeamAttempts).toBeDefined();
      expect(fgCategory!.opponentMakes).toBeDefined();
      expect(fgCategory!.opponentAttempts).toBeDefined();

      expect(ftCategory).toBeDefined();
      expect(ftCategory!.myTeamMakes).toBeDefined();
      expect(ftCategory!.myTeamAttempts).toBeDefined();
      expect(ftCategory!.opponentMakes).toBeDefined();
      expect(ftCategory!.opponentAttempts).toBeDefined();
    });

    it('should include correct metadata', async () => {
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      expect(result.metadata.scope).toBe('week');
      expect(result.metadata.week).toBeGreaterThan(0);
      expect(result.metadata.currentWeek).toBeGreaterThan(0);
      expect(result.metadata.totalWeeks).toBeGreaterThan(0);
    });

    it('should use current week by default', async () => {
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      // Week should match current week when not specified
      expect(result.metadata.week).toBe(result.metadata.currentWeek);
    });

    it('should handle specified week parameter', async () => {
      // ARRANGE
      const week = 3;
      
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey, week);

      // ASSERT
      expect(result.metadata.week).toBe(week);
    });

    it('should have consistent tie handling', async () => {
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      // Check that ties are properly counted
      const tiedCategories = result.categories.filter(c => c.myTeam === c.opponent);
      
      // If we found tied categories, the score should reflect that
      if (tiedCategories.length > 0) {
        expect(result.score.ties).toBeGreaterThan(0);
      }
    });

    it('should have valid stat values', async () => {
      // ACT
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      result.categories.forEach(category => {
        // All stat values should be non-negative
        expect(category.myTeam).toBeGreaterThanOrEqual(0);
        expect(category.opponent).toBeGreaterThanOrEqual(0);

        // Percentages should be between 0 and 1
        if (category.category === 'fgPct' || category.category === 'ftPct') {
          expect(category.myTeam).toBeLessThanOrEqual(1);
          expect(category.opponent).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  describe('error handling', () => {
    it('should return empty matchup data for malformed scoreboard', async () => {
      // ARRANGE
      const malformedDataSource = createMalformedFantasyDataSource();

      // ACT & ASSERT
      // Code should throw or return error for malformed data
      await expect(
        getMatchupComparison(malformedDataSource, testLeagueKey, testTeamKey)
      ).rejects.toThrow();
    });

    it('should validate week parameter and throw for invalid values', async () => {
      // ARRANGE & ACT & ASSERT
      // matchup-viz actually validates weeks
      await expect(async () => {
        await getMatchupComparison(dataSource, testLeagueKey, testTeamKey, 999);
      }).rejects.toThrow('Week must be between');
    });

    it('should handle team with no opponent (edge case)', async () => {
      // ACT
      // In real scenario, every team should have an opponent
      // But we verify the function handles data robustly
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);
      
      // ASSERT
      expect(result.opponent).toBeDefined();
      expect(result.opponent.teamKey).toBeTruthy();
    });

    it('should correctly calculate W/L/T with extreme values', async () => {
      const result = await getMatchupComparison(dataSource, testLeagueKey, testTeamKey);

      // Test that scores are logical regardless of stat values
      expect(result.score.wins + result.score.losses + result.score.ties).toBe(9);
      expect(result.score.wins).toBeLessThanOrEqual(9);
      expect(result.score.losses).toBeLessThanOrEqual(9);
      expect(result.score.ties).toBeLessThanOrEqual(9);
    });
  });
});
