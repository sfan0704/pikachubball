import { describe, it, expect, beforeEach } from 'vitest';
import { getScheduleMatrix } from '../../../../../server/services/viz/schedule-viz';
import { createMockFantasyDataSource } from '../../../fixtures/mock-fantasy-data-source';
import type { FantasyDataSource } from '../../../../../server/services/fantasy-data-source';
import { testLeagueKey, testTeamKey } from '../../../fixtures/test-data';

describe('schedule-viz', () => {
  let dataSource: FantasyDataSource;

  beforeEach(async () => {
    dataSource = createMockFantasyDataSource();
  });

  describe('getScheduleMatrix', () => {
    it('should return schedule matrix with correct structure', async () => {
      // ACT
      const result = await getScheduleMatrix(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      expect(result).toHaveProperty('myTeam');
      expect(result).toHaveProperty('opponent'); // Optional opponent
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('isPlaceholder');
    });

    it('should include myTeam information', async () => {
      // ACT
      const result = await getScheduleMatrix(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      expect(result.myTeam.teamKey).toBe(testTeamKey);
      expect(result.myTeam.teamName).toBeTruthy();
      expect(result.myTeam).toHaveProperty('schedule');
      expect(result.myTeam).toHaveProperty('totalGames');
    });

    it('should include opponent when provided', async () => {
      // ARRANGE
      const opponentTeamKey = '466.l.12345.t.2';
      
      // ACT
      const result = await getScheduleMatrix(
        dataSource,
        testLeagueKey,
        testTeamKey,
        undefined,
        opponentTeamKey
      );

      // ASSERT
      expect(result.opponent).toBeDefined();
      if (result.opponent) {
        expect(result.opponent.teamKey).toBe(opponentTeamKey);
        expect(result.opponent.teamName).toBeTruthy();
      }
    });

    it('should include schedule data', async () => {
      // ACT
      const result = await getScheduleMatrix(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      expect(Array.isArray(result.myTeam.schedule)).toBe(true);
      expect(typeof result.myTeam.totalGames).toBe('number');
    });

    it('should include correct metadata', async () => {
      // ACT
      const result = await getScheduleMatrix(dataSource, testLeagueKey, testTeamKey);

      // ASSERT
      expect(result.metadata).toHaveProperty('currentWeek');
      expect(result.metadata).toHaveProperty('totalWeeks');
      expect(result.metadata.currentWeek).toBeGreaterThan(0);
      expect(result.metadata.totalWeeks).toBeGreaterThan(0);
    });

    it('should handle week parameter', async () => {
      // ARRANGE
      const week = 5;
      
      // ACT
      const result = await getScheduleMatrix(
        dataSource,
        testLeagueKey,
        testTeamKey,
        week
      );

      // ASSERT
      expect(result.metadata).toBeDefined();
    });
  });
});

