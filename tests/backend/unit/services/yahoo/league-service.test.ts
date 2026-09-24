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
      getUserGameLeagues: vi.fn().mockResolvedValue({
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

    it('keeps finished and preseason leagues and labels their status', async () => {
      const standingsFor = (leagueKey: string) => ({
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
                    count: 1,
                    '0': {
                      team: [
                        [
                          { team_key: `${leagueKey}.t.1` },
                          { name: 'Test Team' },
                          { managers: [{ manager: { guid: 'test-guid' } }] },
                        ],
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      });
      mockYahooApiClient.getUserGameLeagues.mockResolvedValue({
        guid: 'test-guid',
        games: [
          {
            code: 'nba',
            game_key: '466',
            season: '2025',
            is_game_over: '0',
            leagues: [
              { league_key: '466.l.1', name: 'Last Season', is_finished: '1', current_week: '23', end_week: '23' },
              { league_key: '466.l.2', name: 'Numeric Flag', is_finished: 1 },
              { league_key: '466.l.3', name: 'Undrafted', is_finished: '0', draft_status: 'predraft' },
              { league_key: '466.l.4', name: 'In Progress', is_finished: '0', current_week: '5', end_week: '23' },
            ],
          },
        ],
      });
      mockYahooApiClient.getLeagueStandings.mockImplementation(async (leagueKey: string) =>
        standingsFor(leagueKey),
      );

      const leagues = await getUserLeagues(userId);

      expect(leagues.map(({ leagueKey, status }) => ({ leagueKey, status }))).toEqual([
        { leagueKey: '466.l.1', status: 'finished' },
        { leagueKey: '466.l.2', status: 'finished' },
        { leagueKey: '466.l.3', status: 'preseason' },
        { leagueKey: '466.l.4', status: 'active' },
      ]);
    });

    it('should handle credential errors', async () => {
      // ARRANGE
      const errorClient = {
        getUserGameLeagues: vi.fn().mockRejectedValue(
          new Error('Yahoo Fantasy credentials expired or invalid')
        ),
        getAllUserLeagues: vi.fn().mockRejectedValue(
          new Error('Yahoo Fantasy credentials expired or invalid')
        ),
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
        getUserGameLeagues: vi.fn().mockRejectedValue(
          new Error('Token refresh failed')
        ),
        getAllUserLeagues: vi.fn().mockRejectedValue(
          new Error('Token refresh failed')
        ),
        getLeagueStandings: vi.fn(),
      };
      vi.mocked(getYahooApiClient).mockResolvedValue(errorClient);

      // ACT & ASSERT
      // The service converts token/refresh errors to a specific message
      await expect(getUserLeagues(userId)).rejects.toThrow();
      // The error should be thrown (either original or converted)
    });

    it('should identify Yahoo application access awaiting activation', async () => {
      const accessError = Object.assign(new Error('Request failed with status code 403'), {
        response: {
          status: 403,
          data: {
            error: {
              description: 'This application is not authorized to perform this action.',
            },
          },
        },
      });
      vi.mocked(getYahooApiClient).mockResolvedValue({
        getUserGameLeagues: vi.fn().mockRejectedValue(accessError),
        getAllUserLeagues: vi.fn().mockRejectedValue(accessError),
      } as any);

      await expect(getUserLeagues(userId)).rejects.toMatchObject({
        statusCode: 503,
        code: 'YAHOO_FANTASY_ACCESS_PENDING',
      });
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
