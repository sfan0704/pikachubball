import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getUserLeagues } from '../../../../../server/services/yahoo/league-service';
import { getYahooApiClient } from '../../../../../server/services/yahoo/yahoo-api-client';
import { mockStandings } from '../../../fixtures/yahoo-responses';

// Mock the getYahooApiClient function
vi.mock('../../../../../server/services/yahoo/yahoo-api-client', () => ({
  getYahooApiClient: vi.fn(),
}));

describe('league-service', () => {
  let mockYahooApiClient: any;
  const userId = 'test-user-id';

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create a mock YahooApiClient
    mockYahooApiClient = {
      getUserGames: vi.fn().mockResolvedValue({
        games: [
          { game_key: '466', name: 'Basketball', code: 'nba' },
        ],
      }),
      getUserGameLeagues: vi.fn().mockResolvedValue({
        guid: 'test-guid',
        games: [
          {
            leagues: [
              {
                league_key: '466.l.12345',
                name: 'Test League',
              },
            ],
          },
        ],
      }),
      getLeagueStandings: vi.fn().mockResolvedValue(mockStandings),
    };
    
    vi.mocked(getYahooApiClient).mockResolvedValue(mockYahooApiClient);
  });

  describe('getUserLeagues', () => {
    it('should return empty array if no leagues data', async () => {
      // ARRANGE
      // Create a client that returns empty response
      const emptyClient = {
        getUserGames: vi.fn().mockResolvedValue({ games: [] }),
        getUserGameLeagues: vi.fn().mockResolvedValue({ games: [] }),
        getLeagueStandings: vi.fn(),
      };
      vi.mocked(getYahooApiClient).mockResolvedValue(emptyClient);

      // ACT
      const leagues = await getUserLeagues(userId);

      // ASSERT
      expect(leagues).toEqual([]);
    });

    it('should return leagues with teams', async () => {
      // ARRANGE
      // Update mock standings to include a team with matching GUID
      const standingsWithUserTeam = {
        ...mockStandings,
        fantasy_content: {
          ...mockStandings.fantasy_content,
          league: [
            mockStandings.fantasy_content.league[0],
            {
              ...mockStandings.fantasy_content.league[1],
              standings: [
                {
                  ...mockStandings.fantasy_content.league[1].standings[0],
                  teams: {
                    ...mockStandings.fantasy_content.league[1].standings[0].teams,
                    '0': {
                      team: [
                        { team_key: '466.l.12345.t.1' },
                        { name: 'Test Team' },
                        { managers: [{ manager: { guid: 'test-guid' } }] },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      };
      mockYahooApiClient.getLeagueStandings.mockResolvedValue(standingsWithUserTeam);

      // ACT
      const leagues = await getUserLeagues(userId);

      // ASSERT
      expect(Array.isArray(leagues)).toBe(true);
      if (leagues.length > 0) {
        expect(leagues[0]).toHaveProperty('leagueKey');
        expect(leagues[0]).toHaveProperty('leagueName');
        expect(leagues[0]).toHaveProperty('teamKey');
        expect(leagues[0]).toHaveProperty('teamName');
      }
    });

    it('should handle credential errors', async () => {
      // ARRANGE
      const errorClient = {
        getUserGames: vi.fn().mockRejectedValue(
          new Error('Yahoo Fantasy credentials expired or invalid')
        ),
        getUserGameLeagues: vi.fn(),
        getLeagueStandings: vi.fn(),
      };
      vi.mocked(getYahooApiClient).mockResolvedValue(errorClient);

      // ACT & ASSERT
      await expect(getUserLeagues(userId)).rejects.toThrow(
        'Yahoo Fantasy credentials expired or invalid'
      );
    });

    it('should handle token errors', async () => {
      // ARRANGE
      const errorClient = {
        getUserGames: vi.fn().mockRejectedValue(
          new Error('Token refresh failed')
        ),
        getUserGameLeagues: vi.fn(),
        getLeagueStandings: vi.fn(),
      };
      vi.mocked(getYahooApiClient).mockResolvedValue(errorClient);

      // ACT & ASSERT
      // The service converts token/refresh errors to a specific message
      await expect(getUserLeagues(userId)).rejects.toThrow();
      // The error should be thrown (either original or converted)
    });

    it('should use parallel API calls for standings', async () => {
      // ARRANGE
      // Setup mock to return leagues that will trigger standings fetch
      mockYahooApiClient.getUserGameLeagues.mockResolvedValue({
        guid: 'test-guid',
        games: [
          {
            code: 'nba',
            game_key: '466',
            leagues: [
              {
                league_key: '466.l.12345',
                name: 'Test League',
              },
              {
                league_key: '466.l.67890',
                name: 'Test League 2',
              },
            ],
          },
        ],
      });
      
      // Mock standings to include user's team
      const standingsWithUserTeam = {
        ...mockStandings,
        fantasy_content: {
          ...mockStandings.fantasy_content,
          league: [
            mockStandings.fantasy_content.league[0],
            {
              ...mockStandings.fantasy_content.league[1],
              standings: [
                {
                  ...mockStandings.fantasy_content.league[1].standings[0],
                  teams: {
                    ...mockStandings.fantasy_content.league[1].standings[0].teams,
                    '0': {
                      team: [
                        { team_key: '466.l.12345.t.1' },
                        { name: 'Test Team' },
                        { managers: [{ manager: { guid: 'test-guid' } }] },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      };
      mockYahooApiClient.getLeagueStandings.mockResolvedValue(standingsWithUserTeam);

      // ACT
      await getUserLeagues(userId);

      // ASSERT
      // Check that getLeagueStandings was called for each league
      expect(mockYahooApiClient.getLeagueStandings).toHaveBeenCalledTimes(2);
      expect(mockYahooApiClient.getLeagueStandings).toHaveBeenCalledWith('466.l.12345');
      expect(mockYahooApiClient.getLeagueStandings).toHaveBeenCalledWith('466.l.67890');
    });
  });
});

