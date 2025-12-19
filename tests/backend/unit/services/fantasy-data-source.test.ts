import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YahooFantasyDataSource } from '../../../../server/services/fantasy-data-source';
import { getYahooApiClient } from '../../../../server/services/yahoo/yahoo-api-client';

// Mock the getYahooApiClient function
vi.mock('../../../../server/services/yahoo/yahoo-api-client', () => ({
  getYahooApiClient: vi.fn(),
}));

describe('YahooFantasyDataSource', () => {
  let dataSource: YahooFantasyDataSource;
  let mockYahooApiClient: any;
  const userId = 'test-user-id';

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create a mock YahooApiClient
    mockYahooApiClient = {
      getLeagueStandings: vi.fn().mockResolvedValue({ fantasy_content: { league: [] } }),
      getLeagueSettings: vi.fn().mockResolvedValue({ fantasy_content: { league: [] } }),
      getLeagueScoreboard: vi.fn().mockResolvedValue({ fantasy_content: { league: [] } }),
      getTeamRoster: vi.fn().mockResolvedValue({ fantasy_content: { team: [] } }),
      getPlayerStats: vi.fn().mockResolvedValue({ fantasy_content: { players: [] } }),
    };
    
    vi.mocked(getYahooApiClient).mockResolvedValue(mockYahooApiClient);
    dataSource = new YahooFantasyDataSource(userId);
  });

  describe('getLeagueStandings', () => {
    it('should call yahooApiClient.getLeagueStandings', async () => {
      // ARRANGE
      const leagueKey = '466.l.12345';
      const expectedResponse = { fantasy_content: { league: [] } };
      mockYahooApiClient.getLeagueStandings.mockResolvedValue(expectedResponse);

      // ACT
      const result = await dataSource.getLeagueStandings(leagueKey);

      // ASSERT
      expect(getYahooApiClient).toHaveBeenCalledWith(userId);
      expect(mockYahooApiClient.getLeagueStandings).toHaveBeenCalledWith(leagueKey);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getLeagueSettings', () => {
    it('should call yahooApiClient.getLeagueSettings', async () => {
      // ARRANGE
      const leagueKey = '466.l.12345';
      const expectedResponse = { fantasy_content: { league: [] } };
      mockYahooApiClient.getLeagueSettings.mockResolvedValue(expectedResponse);

      // ACT
      const result = await dataSource.getLeagueSettings(leagueKey);

      // ASSERT
      expect(getYahooApiClient).toHaveBeenCalledWith(userId);
      expect(mockYahooApiClient.getLeagueSettings).toHaveBeenCalledWith(leagueKey);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getLeagueScoreboard', () => {
    it('should call yahooApiClient.getLeagueScoreboard with week', async () => {
      // ARRANGE
      const leagueKey = '466.l.12345';
      const week = 5;
      const expectedResponse = { fantasy_content: { league: [] } };
      mockYahooApiClient.getLeagueScoreboard.mockResolvedValue(expectedResponse);

      // ACT
      const result = await dataSource.getLeagueScoreboard(leagueKey, week);

      // ASSERT
      expect(getYahooApiClient).toHaveBeenCalledWith(userId);
      expect(mockYahooApiClient.getLeagueScoreboard).toHaveBeenCalledWith(leagueKey, week);
      expect(result).toEqual(expectedResponse);
    });

    it('should call yahooApiClient.getLeagueScoreboard without week', async () => {
      // ARRANGE
      const leagueKey = '466.l.12345';
      const expectedResponse = { fantasy_content: { league: [] } };
      mockYahooApiClient.getLeagueScoreboard.mockResolvedValue(expectedResponse);

      // ACT
      const result = await dataSource.getLeagueScoreboard(leagueKey);

      // ASSERT
      expect(getYahooApiClient).toHaveBeenCalledWith(userId);
      expect(mockYahooApiClient.getLeagueScoreboard).toHaveBeenCalledWith(leagueKey, undefined);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getTeamRoster', () => {
    it('should call yahooApiClient.getTeamRoster', async () => {
      // ARRANGE
      const teamKey = '466.l.12345.t.1';
      const expectedResponse = { fantasy_content: { team: [] } };
      mockYahooApiClient.getTeamRoster.mockResolvedValue(expectedResponse);

      // ACT
      const result = await dataSource.getTeamRoster(teamKey);

      // ASSERT
      expect(getYahooApiClient).toHaveBeenCalledWith(userId);
      expect(mockYahooApiClient.getTeamRoster).toHaveBeenCalledWith(teamKey);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getPlayerStats', () => {
    it('should call yahooApiClient.getPlayerStats with first player key', async () => {
      // ARRANGE
      const playerKeys = ['466.p.123', '466.p.456'];
      const expectedResponse = { fantasy_content: { players: [] } };
      mockYahooApiClient.getPlayerStats.mockResolvedValue(expectedResponse);

      // ACT
      const result = await dataSource.getPlayerStats(playerKeys);

      // ASSERT
      expect(getYahooApiClient).toHaveBeenCalledWith(userId);
      // Note: YahooFantasyDataSource currently only uses the first player key
      expect(mockYahooApiClient.getPlayerStats).toHaveBeenCalledWith(playerKeys[0]);
      expect(result).toEqual(expectedResponse);
    });
  });
});

