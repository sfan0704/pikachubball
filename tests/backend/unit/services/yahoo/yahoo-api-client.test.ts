import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YahooApiClient, getYahooApiClient } from '../../../../../server/services/yahoo/yahoo-api-client';
import type { YahooTokenStorage } from '../../../../../server/storage/yahoo-token-storage';
import { env } from '../../../../../server/config/env';
import { refreshAccessToken } from '../../../../../server/yahoo-auth';
import axios from 'axios';
import {
  YahooReconnectRequiredError,
  YahooUnavailableError,
} from '../../../../../server/services/yahoo/yahoo-request-policy';

// Mock dependencies
vi.mock('../../../../../server/config/env', () => ({
  env: {
    YAHOO_CLIENT_ID: 'test-client-id',
    YAHOO_CLIENT_SECRET: 'test-client-secret',
  },
}));
vi.mock('../../../../../server/yahoo-auth');
vi.mock('axios');

describe('YahooApiClient', () => {
  const storage = {
    getYahooToken: vi.fn(),
    saveYahooToken: vi.fn(),
    deleteYahooToken: vi.fn(),
  } as unknown as YahooTokenStorage;
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
  });

  describe('create', () => {
    it('should create client using env credentials', async () => {
      // ARRANGE
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: 'token-1',
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });
      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn(),
      } as any);

      // ACT
      const client = await YahooApiClient.create(userId, storage);

      // ASSERT
      expect(client).toBeInstanceOf(YahooApiClient);
    });

    it('should throw error when env credentials not configured', async () => {
      // ARRANGE
      (env as any).YAHOO_CLIENT_ID = undefined;
      (env as any).YAHOO_CLIENT_SECRET = undefined;

      // ACT & ASSERT
      await expect(YahooApiClient.create(userId, storage)).rejects.toThrow(
        'Yahoo OAuth credentials are not configured'
      );
    });

    it('should throw error when no token available', async () => {
      // ARRANGE
      vi.mocked(storage.getYahooToken).mockResolvedValue(undefined); // No token

      // ACT & ASSERT
      await expect(YahooApiClient.create(userId, storage)).rejects.toBeInstanceOf(
        YahooReconnectRequiredError
      );
    });

    it('should refresh token if expired', async () => {
      // ARRANGE
      const expiredExpiresAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';
      const newExpiresIn = 3600;

      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: 'token-1',
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
        id: 'token-1',
        userId,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + newExpiresIn,
      });
      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn(),
      } as any);

      // ACT
      const client = await YahooApiClient.create(userId, storage);

      // ASSERT
      // Uses env credentials
      expect(refreshAccessToken).toHaveBeenCalledWith(refreshToken, clientId, clientSecret);
      expect(storage.saveYahooToken).toHaveBeenCalled();
      expect(client).toBeInstanceOf(YahooApiClient);
    });

    it('should throw error if token refresh fails', async () => {
      // ARRANGE
      const expiredExpiresAt = Math.floor(Date.now() / 1000) - 3600;
      
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: 'token-1',
        userId,
        accessToken,
        refreshToken,
        expiresAt: expiredExpiresAt,
      });
      vi.mocked(refreshAccessToken).mockRejectedValue(new YahooReconnectRequiredError());

      // ACT & ASSERT
      await expect(YahooApiClient.create(userId, storage)).rejects.toBeInstanceOf(
        YahooReconnectRequiredError
      );
    });
  });

  describe('apiRequest', () => {
    let client: YahooApiClient;
    let mockAxiosInstance: any;

    beforeEach(async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: 'token-1',
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId, storage);
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
          timeout: 8_000,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      expect(result).toEqual(responseData);
    });

    it('decodes HTML entities in Yahoo text before returning', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { team: { name: 'Ball don&#39;t lie', team_key: '466.l.1.t.4' } },
      });

      const result = await (client as any).apiRequest('/team/466.l.1.t.4');

      expect(result).toEqual({ team: { name: "Ball don't lie", team_key: '466.l.1.t.4' } });
    });

    it('returns the raw Yahoo response unchanged from getRawApiResponse', async () => {
      const raw = { team: { name: 'Ball don&#39;t lie' } };
      mockAxiosInstance.get.mockResolvedValue({ data: raw });

      const result = await client.getRawApiResponse('/team/466.l.1.t.4');

      expect(result).toEqual({ team: { name: 'Ball don&#39;t lie' } });
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
        id: 'token-1',
        userId,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + newExpiresIn,
      });

      // ACT
      const result = await (client as any).apiRequest(endpoint);

      // ASSERT
      // Uses env credentials
      expect(refreshAccessToken).toHaveBeenCalledWith(refreshToken, clientId, clientSecret);
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

      vi.mocked(refreshAccessToken).mockRejectedValue(new YahooReconnectRequiredError());

      // ACT & ASSERT
      await expect((client as any).apiRequest(endpoint)).rejects.toBeInstanceOf(
        YahooReconnectRequiredError
      );
    });

    it('should re-throw non-retryable client errors unchanged', async () => {
      // ARRANGE
      const endpoint = '/test/endpoint';
      const error404 = {
        response: { status: 404, statusText: 'Not Found', data: { error: 'Missing' } },
      };
      mockAxiosInstance.get.mockRejectedValueOnce(error404);

      // ACT & ASSERT
      await expect((client as any).apiRequest(endpoint)).rejects.toEqual(error404);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh coordination and provider failures', () => {
    const now = () => Math.floor(Date.now() / 1000);
    const expired = () => ({ userId, accessToken, refreshToken, expiresAt: now() - 60, version: 4 });
    let mockAxiosInstance: { get: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      vi.mocked(storage.getYahooToken).mockReset();
      vi.mocked(storage.saveYahooToken).mockReset();
      vi.mocked(refreshAccessToken).mockReset();
      mockAxiosInstance = { get: vi.fn() };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);
    });

    it('keeps the current refresh token when Yahoo omits a replacement', async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue(expired());
      vi.mocked(refreshAccessToken).mockResolvedValue({ accessToken: 'rotated-access', expiresIn: 3600 });
      vi.mocked(storage.saveYahooToken).mockImplementation(async (token) => ({ ...token, version: 5 }));

      await YahooApiClient.create(userId, storage);

      expect(storage.saveYahooToken).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'rotated-access', refreshToken }),
        { expectedVersion: 4 },
      );
    });

    it('uses a rotated refresh token for the next refresh', async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue({ ...expired(), expiresAt: now() + 3600 });
      vi.mocked(refreshAccessToken)
        .mockResolvedValueOnce({ accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 3600 })
        .mockResolvedValueOnce({ accessToken: 'access-3', expiresIn: 3600 });
      vi.mocked(storage.saveYahooToken).mockImplementation(async (token, options) => ({
        ...token,
        version: (options?.expectedVersion ?? 0) + 1,
      }));
      mockAxiosInstance.get
        .mockRejectedValueOnce({ response: { status: 401 } })
        .mockResolvedValueOnce({ data: 'first' })
        .mockRejectedValueOnce({ response: { status: 401 } })
        .mockResolvedValueOnce({ data: 'second' });
      const client = await YahooApiClient.create(userId, storage);

      await (client as any).apiRequest('/one');
      await (client as any).apiRequest('/two');

      expect(vi.mocked(refreshAccessToken).mock.calls.map(([token]) => token)).toEqual([
        refreshToken,
        'refresh-2',
      ]);
      expect(storage.saveYahooToken).toHaveBeenLastCalledWith(
        expect.objectContaining({ accessToken: 'access-3', refreshToken: 'refresh-2' }),
        { expectedVersion: 5 },
      );
    });

    it('shares one refresh between concurrent requests for the same user', async () => {
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => (release = resolve));
      vi.mocked(storage.getYahooToken).mockResolvedValue(expired());
      vi.mocked(refreshAccessToken).mockImplementation(async () => {
        await barrier;
        return { accessToken: 'shared-access', expiresIn: 3600 };
      });
      vi.mocked(storage.saveYahooToken).mockImplementation(async (token) => ({ ...token, version: 5 }));

      const first = YahooApiClient.create(userId, storage);
      const second = YahooApiClient.create(userId, storage);
      await vi.waitFor(() => expect(refreshAccessToken).toHaveBeenCalled());
      release();
      const clients = await Promise.all([first, second]);

      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(storage.saveYahooToken).toHaveBeenCalledTimes(1);
      for (const client of clients) {
        expect((client as any).accessToken).toBe('shared-access');
        expect((client as any).tokenVersion).toBe(5);
      }
    });

    it('adopts the token another instance committed instead of overwriting it', async () => {
      const winner = { userId, accessToken: 'winner-access', refreshToken, expiresAt: now() + 3600, version: 5 };
      vi.mocked(storage.getYahooToken)
        .mockResolvedValueOnce(expired())
        .mockResolvedValueOnce(winner);
      vi.mocked(refreshAccessToken).mockResolvedValue({ accessToken: 'late-access', expiresIn: 3600 });
      vi.mocked(storage.saveYahooToken).mockRejectedValue(
        new Error('Yahoo token changed during refresh; stale result rejected'),
      );

      const client = await YahooApiClient.create(userId, storage);

      expect(storage.saveYahooToken).toHaveBeenCalledTimes(1);
      expect((client as any).accessToken).toBe('winner-access');
      expect((client as any).tokenVersion).toBe(5);
    });

    it('fails closed when the user disconnected during the refresh', async () => {
      vi.mocked(storage.getYahooToken)
        .mockResolvedValueOnce(expired())
        .mockResolvedValueOnce(undefined);
      vi.mocked(refreshAccessToken).mockResolvedValue({ accessToken: 'late-access', expiresIn: 3600 });
      vi.mocked(storage.saveYahooToken).mockRejectedValue(
        new Error('Yahoo token changed during refresh; stale result rejected'),
      );

      await expect(YahooApiClient.create(userId, storage)).rejects.toBeInstanceOf(
        YahooReconnectRequiredError,
      );
      expect(storage.saveYahooToken).toHaveBeenCalledTimes(1);
    });

    it('requires reconnecting when Yahoo still returns 401 after a refresh', async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue({ ...expired(), expiresAt: now() + 3600 });
      vi.mocked(refreshAccessToken).mockResolvedValue({ accessToken: 'new-access', expiresIn: 3600 });
      vi.mocked(storage.saveYahooToken).mockImplementation(async (token) => ({ ...token, version: 5 }));
      mockAxiosInstance.get.mockRejectedValue({ response: { status: 401 } });
      const client = await YahooApiClient.create(userId, storage);

      await expect((client as any).apiRequest('/endpoint')).rejects.toBeInstanceOf(
        YahooReconnectRequiredError,
      );
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('gives up on repeated 5xx within the request budget', async () => {
      let clockNow = Date.now();
      const clock = {
        now: () => clockNow,
        sleep: async (milliseconds: number) => {
          clockNow += milliseconds;
        },
      };
      vi.mocked(storage.getYahooToken).mockResolvedValue({ ...expired(), expiresAt: now() + 3600 });
      mockAxiosInstance.get.mockRejectedValue({ isAxiosError: true, response: { status: 503 } });
      const client = await YahooApiClient.create(userId, storage, clock);

      await expect((client as any).apiRequest('/endpoint')).rejects.toBeInstanceOf(
        YahooUnavailableError,
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('getUserGames', () => {
    let client: YahooApiClient;
    let mockAxiosInstance: any;

    beforeEach(async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: 'token-1',
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId, storage);
    });

    it('should return games array when games exist', async () => {
      // ARRANGE
      const apiResponse = {
        fantasy_content: {
          users: [
            {
              user: [
                { guid: 'test-guid' },
                {
                  games: {
                    '0': {
                      game: {
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
                { guid: 'test-guid' },
                {
                  games: {},
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
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: 'token-1',
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId, storage);
    });

    it('should return leagues for game code', async () => {
      // ARRANGE
      const gameCode = 'nba';
      
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
                            code: 'nba',
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
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/users;use_login=1/games;game_codes=nba/leagues?format=json',
        { timeout: 8_000, headers: { Authorization: `Bearer ${accessToken}` } },
      );
    });

    it('should return no games if Yahoo has no leagues for the game code', async () => {
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
      await expect(client.getUserGameLeagues(gameCode)).resolves.toEqual({
        guid: 'test-guid',
        games: [{ leagues: [] }],
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/users;use_login=1/games;game_codes=invalid/leagues?format=json',
        { timeout: 8_000, headers: { Authorization: `Bearer ${accessToken}` } },
      );
    });
  });

  describe('League resource methods', () => {
    let client: YahooApiClient;
    let mockAxiosInstance: any;

    beforeEach(async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: 'token-1',
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId, storage);
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
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: 'token-1',
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId, storage);
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
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: 'token-1',
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      mockAxiosInstance = {
        get: vi.fn(),
      };
      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

      client = await YahooApiClient.create(userId, storage);
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
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: 'token-1',
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });
      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn(),
      } as any);

      // ACT
      const client = await getYahooApiClient(userId, storage);

      // ASSERT
      expect(client).toBeInstanceOf(YahooApiClient);
    });
  });
});
