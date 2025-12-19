import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YahooApiClient, getYahooApiClient } from '../../../../../server/services/yahoo/yahoo-api-client';
import { storage } from '../../../../../server/storage';
import { decrypt } from '../../../../../server/utils/encryption';
import { env } from '../../../../../server/config/env';
import { refreshAccessToken } from '../../../../../server/yahoo-auth';
import axios from 'axios';

// Mock dependencies
vi.mock('../../../../../server/storage');
vi.mock('../../../../../server/utils/encryption');
vi.mock('../../../../../server/config/env', () => ({
  env: {
    YAHOO_CLIENT_ID: 'test-client-id',
    YAHOO_CLIENT_SECRET: 'test-client-secret',
  },
}));
vi.mock('../../../../../server/yahoo-auth');
vi.mock('axios');

describe('YahooApiClient', () => {
  const userId = 'test-user-id';
  const clientId = 'test-client-id';
  const clientSecret = 'test-client-secret';
  const accessToken = 'test-access-token';
  const refreshToken = 'test-refresh-token';
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset env mocks
    (env as any).YAHOO_CLIENT_ID = clientId;
    (env as any).YAHOO_CLIENT_SECRET = clientSecret;
    vi.mocked(decrypt).mockImplementation((encrypted: string) => encrypted.replace('encrypted-', ''));
  });

  describe('create', () => {
    it('should create client with user credentials when available', async () => {
      // ARRANGE
      const encryptedClientId = 'encrypted-client-id';
      const encryptedClientSecret = 'encrypted-client-secret';
      const credentials = {
        userId,
        encryptedClientId,
        encryptedClientSecret,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });
      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn(),
      } as any);

      // ACT
      const client = await YahooApiClient.create(userId);

      // ASSERT
      expect(storage.getYahooCredentials).toHaveBeenCalledWith(userId);
      expect(decrypt).toHaveBeenCalledWith(encryptedClientId);
      expect(decrypt).toHaveBeenCalledWith(encryptedClientSecret);
      expect(client).toBeInstanceOf(YahooApiClient);
    });

    it('should create client with env credentials when user credentials not available', async () => {
      // ARRANGE
      // Controller now requires user credentials, so this should throw
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(undefined);

      // ACT & ASSERT
      await expect(YahooApiClient.create(userId)).rejects.toThrow(
        'Yahoo OAuth credentials are required'
      );
      expect(storage.getYahooCredentials).toHaveBeenCalledWith(userId);
    });

    it('should throw error when no credentials available', async () => {
      // ARRANGE
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(undefined);
      (env as any).YAHOO_CLIENT_ID = undefined;
      (env as any).YAHOO_CLIENT_SECRET = undefined;

      // ACT & ASSERT
      await expect(YahooApiClient.create(userId)).rejects.toThrow(
        'Yahoo OAuth credentials are required'
      );
    });

    it('should throw error when no token available', async () => {
      // ARRANGE
      const credentials = {
        userId,
        encryptedClientId: 'encrypted-client-id',
        encryptedClientSecret: 'encrypted-client-secret',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(storage.getYahooToken).mockResolvedValue(undefined); // No token

      // ACT & ASSERT
      await expect(YahooApiClient.create(userId)).rejects.toThrow(
        'No valid Yahoo access token available'
      );
    });

    it('should refresh token if expired', async () => {
      // ARRANGE
      const expiredExpiresAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';
      const newExpiresIn = 3600;
      const credentials = {
        userId,
        encryptedClientId: 'encrypted-client-id',
        encryptedClientSecret: 'encrypted-client-secret',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        userId,
        accessToken,
        refreshToken,
        expiresAt: expiredExpiresAt,
      });
      vi.mocked(refreshAccessToken).mockResolvedValue({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: newExpiresIn,
      });
      vi.mocked(storage.saveYahooToken).mockResolvedValue({
        userId,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + newExpiresIn,
      });
      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn(),
      } as any);

      // ACT
      const client = await YahooApiClient.create(userId);

      // ASSERT
      // decrypt removes 'encrypted-' prefix, so 'encrypted-client-id' -> 'client-id'
      expect(refreshAccessToken).toHaveBeenCalledWith(refreshToken, 'client-id', 'client-secret');
      expect(storage.saveYahooToken).toHaveBeenCalled();
      expect(client).toBeInstanceOf(YahooApiClient);
    });

    it('should throw error if token refresh fails', async () => {
      // ARRANGE
      const expiredExpiresAt = Math.floor(Date.now() / 1000) - 3600;
      const credentials = {
        userId,
        encryptedClientId: 'encrypted-client-id',
        encryptedClientSecret: 'encrypted-client-secret',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        userId,
        accessToken,
        refreshToken,
        expiresAt: expiredExpiresAt,
      });
      vi.mocked(refreshAccessToken).mockRejectedValue(new Error('Refresh failed'));

      // ACT & ASSERT
      await expect(YahooApiClient.create(userId)).rejects.toThrow(
        'Yahoo access token expired and refresh failed'
      );
    });
  });

  describe('apiRequest', () => {
    let client: YahooApiClient;
    let mockAxiosInstance: any;

    beforeEach(async () => {
      const credentials = {
        userId,
        encryptedClientId: 'encrypted-client-id',
        encryptedClientSecret: 'encrypted-client-secret',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId);
    });

    it('should make successful API request', async () => {
      // ARRANGE
      const endpoint = '/test/endpoint';
      const responseData = { data: 'test' };
      mockAxiosInstance.get.mockResolvedValue({ data: responseData });

      // ACT
      // Access private method via type assertion for testing
      const result = await (client as any).apiRequest(endpoint);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `${endpoint}?format=json`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      expect(result).toEqual(responseData);
    });

    it('should include query parameters in request', async () => {
      // ARRANGE
      const endpoint = '/test/endpoint';
      const params = { key: 'value', num: 123 };
      const responseData = { data: 'test' };
      mockAxiosInstance.get.mockResolvedValue({ data: responseData });

      // ACT
      const result = await (client as any).apiRequest(endpoint, params);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('key=value'),
        expect.any(Object)
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('num=123'),
        expect.any(Object)
      );
      expect(result).toEqual(responseData);
    });

    it('should refresh token and retry on 401 error', async () => {
      // ARRANGE
      const endpoint = '/test/endpoint';
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';
      const newExpiresIn = 3600;
      
      // First call returns 401
      const error401 = {
        response: { status: 401 },
      };
      mockAxiosInstance.get
        .mockRejectedValueOnce(error401)
        .mockResolvedValueOnce({ data: { success: true } });

      vi.mocked(refreshAccessToken).mockResolvedValue({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: newExpiresIn,
      });
      vi.mocked(storage.saveYahooToken).mockResolvedValue({
        userId,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + newExpiresIn,
      });

      // ACT
      const result = await (client as any).apiRequest(endpoint);

      // ASSERT
      // decrypt removes 'encrypted-' prefix, so credentials are decrypted to 'client-id' and 'client-secret'
      expect(refreshAccessToken).toHaveBeenCalledWith(refreshToken, 'client-id', 'client-secret');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });

    it('should throw error if token refresh fails on 401', async () => {
      // ARRANGE
      const endpoint = '/test/endpoint';
      const error401 = {
        response: { status: 401 },
      };
      mockAxiosInstance.get.mockRejectedValueOnce(error401);

      vi.mocked(refreshAccessToken).mockRejectedValue(new Error('Refresh failed'));

      // ACT & ASSERT
      await expect((client as any).apiRequest(endpoint)).rejects.toThrow(
        'Yahoo access token expired and refresh failed'
      );
    });

    it('should re-throw non-401 errors', async () => {
      // ARRANGE
      const endpoint = '/test/endpoint';
      const error500 = {
        response: { status: 500, statusText: 'Internal Server Error', data: { error: 'Server error' } },
      };
      mockAxiosInstance.get.mockRejectedValueOnce(error500);

      // ACT & ASSERT
      await expect((client as any).apiRequest(endpoint)).rejects.toEqual(error500);
    });
  });

  describe('getUserGames', () => {
    let client: YahooApiClient;
    let mockAxiosInstance: any;

    beforeEach(async () => {
      const encryptedClientId = 'encrypted-client-id';
      const encryptedClientSecret = 'encrypted-client-secret';
      const credentials = {
        userId,
        encryptedClientId,
        encryptedClientSecret,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId);
    });

    it('should return games array when games exist', async () => {
      // ARRANGE
      // Implementation expects: userData[0] = properties object, userData[1] = subresources object
      // gamesData['0'].game is an array [gameProps, leaguesData]
      // But the implementation maps over games and accesses g.game_key directly
      // So g should be the gameProps object, not the array
      const apiResponse = {
        fantasy_content: {
          users: [
            {
              user: [
                { guid: 'test-guid' }, // userData[0] - properties object
                {
                  games: {
                    '0': {
                      game: {
                        // gameProps object directly (not wrapped in array)
                        game_key: '466',
                        name: 'Basketball',
                        code: 'nba',
                        season: '2024',
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      };
      mockAxiosInstance.get.mockResolvedValue({ data: apiResponse });

      // ACT
      const result = await client.getUserGames();

      // ASSERT
      expect(result.guid).toBe('test-guid');
      expect(result.games).toHaveLength(1);
      expect(result.games[0]).toMatchObject({
        game_key: '466',
        name: 'Basketball',
        code: 'nba',
        season: '2024',
      });
    });

    it('should return empty games array when no games', async () => {
      // ARRANGE
      const apiResponse = {
        fantasy_content: {
          users: [
            {
              user: [
                { guid: 'test-guid' }, // userData[0] - properties object
                {
                  games: {}, // Empty games object
                },
              ],
            },
          ],
        },
      };
      mockAxiosInstance.get.mockResolvedValue({ data: apiResponse });

      // ACT
      const result = await client.getUserGames();

      // ASSERT
      expect(result).toEqual({
        guid: 'test-guid',
        games: [],
      });
    });

    it('should handle single game object (not array)', async () => {
      // ARRANGE
      const apiResponse = {
        fantasy_content: {
          users: [
            {
              user: [
                { guid: 'test-guid' },
                {
                  games: {
                    game: {
                      game_key: '466',
                      name: 'Basketball',
                      code: 'nba',
                      season: '2024',
                    },
                  },
                },
              ],
            },
          ],
        },
      };
      mockAxiosInstance.get.mockResolvedValue({ data: apiResponse });

      // ACT
      const result = await client.getUserGames();

      // ASSERT
      expect(result.games).toHaveLength(1);
      expect(result.games[0]).toEqual({
        game_key: '466',
        name: 'Basketball',
        code: 'nba',
        season: '2024',
      });
    });

    it('should return empty games when users array is empty', async () => {
      // ARRANGE
      const apiResponse = {
        fantasy_content: {
          users: [],
        },
      };
      mockAxiosInstance.get.mockResolvedValue({ data: apiResponse });

      // ACT
      const result = await client.getUserGames();

      // ASSERT
      expect(result).toEqual({ games: [] });
    });
  });

  describe('getUserGameLeagues', () => {
    let client: YahooApiClient;
    let mockAxiosInstance: any;

    beforeEach(async () => {
      const encryptedClientId = 'encrypted-client-id';
      const encryptedClientSecret = 'encrypted-client-secret';
      const credentials = {
        userId,
        encryptedClientId,
        encryptedClientSecret,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId);
    });

    it('should return leagues for game code', async () => {
      // ARRANGE
      const gameCode = 'nba';
      
      // Mock getUserGames response - must return game with code 'nba'
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          fantasy_content: {
            users: [
              {
                user: [
                  { guid: 'test-guid' }, // userData[0] - properties
                  {
                    games: {
                      '0': {
                        game: {
                          // gameProps object directly
                          game_key: '466',
                          name: 'Basketball',
                          code: 'nba',
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      });

      // Mock getUserGameLeagues response
      // Yahoo API structure: game[0] = game properties, game[1] = leagues subresource
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          fantasy_content: {
            users: [
              {
                user: [
                  { guid: 'test-guid' },
                  {
                    games: {
                      game: [
                        [
                          {
                            game_key: '466',
                            name: 'Basketball',
                          },
                          {
                            leagues: {
                              league: [
                                [
                                  {
                                    league_key: '466.l.12345',
                                    name: 'Test League',
                                  },
                                ],
                              ],
                            },
                          },
                        ],
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      });

      // ACT
      const result = await client.getUserGameLeagues(gameCode);

      // ASSERT
      expect(result.games).toHaveLength(1);
      expect(result.games[0].leagues).toHaveLength(1);
      expect(result.games[0].leagues[0]).toEqual({
        league_key: '466.l.12345',
        name: 'Test League',
      });
    });

    it('should throw error if game code not found', async () => {
      // ARRANGE
      const gameCode = 'invalid';
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          fantasy_content: {
            users: [
              {
                user: [
                  { guid: 'test-guid' },
                  {
                    games: {
                      game: [],
                    },
                  },
                ],
              },
            ],
          },
        },
      });

      // ACT & ASSERT
      await expect(client.getUserGameLeagues(gameCode)).rejects.toThrow(
        `Game code ${gameCode} not found`
      );
    });
  });

  describe('League resource methods', () => {
    let client: YahooApiClient;
    let mockAxiosInstance: any;

    beforeEach(async () => {
      const encryptedClientId = 'encrypted-client-id';
      const encryptedClientSecret = 'encrypted-client-secret';
      const credentials = {
        userId,
        encryptedClientId,
        encryptedClientSecret,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId);
    });

    it('should get league standings', async () => {
      // ARRANGE
      const leagueKey = '466.l.12345';
      const standingsData = { standings: 'data' };
      mockAxiosInstance.get.mockResolvedValue({ data: standingsData });

      // ACT
      const result = await client.getLeagueStandings(leagueKey);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`/league/${leagueKey}/standings`),
        expect.any(Object)
      );
      expect(result).toEqual(standingsData);
    });

    it('should get league settings', async () => {
      // ARRANGE
      const leagueKey = '466.l.12345';
      const settingsData = { settings: 'data' };
      mockAxiosInstance.get.mockResolvedValue({ data: settingsData });

      // ACT
      const result = await client.getLeagueSettings(leagueKey);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`/league/${leagueKey}/settings`),
        expect.any(Object)
      );
      expect(result).toEqual(settingsData);
    });

    it('should get league scoreboard without week', async () => {
      // ARRANGE
      const leagueKey = '466.l.12345';
      const scoreboardData = { scoreboard: 'data' };
      mockAxiosInstance.get.mockResolvedValue({ data: scoreboardData });

      // ACT
      const result = await client.getLeagueScoreboard(leagueKey);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`/league/${leagueKey}/scoreboard`),
        expect.any(Object)
      );
      expect(result).toEqual(scoreboardData);
    });

    it('should get league scoreboard with week', async () => {
      // ARRANGE
      const leagueKey = '466.l.12345';
      const week = 5;
      const scoreboardData = { scoreboard: 'data' };
      mockAxiosInstance.get.mockResolvedValue({ data: scoreboardData });

      // ACT
      const result = await client.getLeagueScoreboard(leagueKey, week);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`/league/${leagueKey}/scoreboard`),
        expect.any(Object)
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`week=${week}`),
        expect.any(Object)
      );
      expect(result).toEqual(scoreboardData);
    });
  });

  describe('Team resource methods', () => {
    let client: YahooApiClient;
    let mockAxiosInstance: any;

    beforeEach(async () => {
      const encryptedClientId = 'encrypted-client-id';
      const encryptedClientSecret = 'encrypted-client-secret';
      const credentials = {
        userId,
        encryptedClientId,
        encryptedClientSecret,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId);
    });

    it('should get team roster without week', async () => {
      // ARRANGE
      const teamKey = '466.l.12345.t.1';
      const rosterData = { roster: 'data' };
      mockAxiosInstance.get.mockResolvedValue({ data: rosterData });

      // ACT
      const result = await client.getTeamRoster(teamKey);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`/team/${teamKey}/roster`),
        expect.any(Object)
      );
      expect(result).toEqual(rosterData);
    });

    it('should get team roster with week', async () => {
      // ARRANGE
      const teamKey = '466.l.12345.t.1';
      const week = 5;
      const rosterData = { roster: 'data' };
      mockAxiosInstance.get.mockResolvedValue({ data: rosterData });

      // ACT
      const result = await client.getTeamRoster(teamKey, week);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`/team/${teamKey}/roster`),
        expect.any(Object)
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`week=${week}`),
        expect.any(Object)
      );
      expect(result).toEqual(rosterData);
    });
  });

  describe('Player resource methods', () => {
    let client: YahooApiClient;
    let mockAxiosInstance: any;

    beforeEach(async () => {
      const encryptedClientId = 'encrypted-client-id';
      const encryptedClientSecret = 'encrypted-client-secret';
      const credentials = {
        userId,
        encryptedClientId,
        encryptedClientSecret,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId);
    });

    it('should get player stats without week', async () => {
      // ARRANGE
      const playerKey = '466.p.12345';
      const statsData = { stats: 'data' };
      mockAxiosInstance.get.mockResolvedValue({ data: statsData });

      // ACT
      const result = await client.getPlayerStats(playerKey);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`/player/${playerKey}/stats`),
        expect.any(Object)
      );
      expect(result).toEqual(statsData);
    });

    it('should get player stats with numeric week', async () => {
      // ARRANGE
      const playerKey = '466.p.12345';
      const week = 5;
      const statsData = { stats: 'data' };
      mockAxiosInstance.get.mockResolvedValue({ data: statsData });

      // ACT
      const result = await client.getPlayerStats(playerKey, week);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`/player/${playerKey}/stats`),
        expect.any(Object)
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`type=week;week=${week}`),
        expect.any(Object)
      );
      expect(result).toEqual(statsData);
    });

    it('should get player stats with lastweek type', async () => {
      // ARRANGE
      const playerKey = '466.p.12345';
      const week = 'lastweek';
      const statsData = { stats: 'data' };
      mockAxiosInstance.get.mockResolvedValue({ data: statsData });

      // ACT
      const result = await client.getPlayerStats(playerKey, week);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`/player/${playerKey}/stats`),
        expect.any(Object)
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`type=lastweek`),
        expect.any(Object)
      );
      expect(result).toEqual(statsData);
    });

    it('should get player stats with lastmonth type', async () => {
      // ARRANGE
      const playerKey = '466.p.12345';
      const week = 'lastmonth';
      const statsData = { stats: 'data' };
      mockAxiosInstance.get.mockResolvedValue({ data: statsData });

      // ACT
      const result = await client.getPlayerStats(playerKey, week);

      // ASSERT
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`/player/${playerKey}/stats`),
        expect.any(Object)
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining(`type=lastmonth`),
        expect.any(Object)
      );
      expect(result).toEqual(statsData);
    });
  });

  describe('getYahooApiClient', () => {
    it('should create and return YahooApiClient instance', async () => {
      // ARRANGE
      const encryptedClientId = 'encrypted-client-id';
      const encryptedClientSecret = 'encrypted-client-secret';
      const credentials = {
        userId,
        encryptedClientId,
        encryptedClientSecret,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });
      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn(),
      } as any);

      // ACT
      const client = await getYahooApiClient(userId);

      // ASSERT
      expect(client).toBeInstanceOf(YahooApiClient);
    });
  });
});
