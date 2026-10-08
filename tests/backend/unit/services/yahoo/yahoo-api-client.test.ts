import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { YahooApiClient } from "../../../../../server/fantasy/yahoo/yahoo-api-client";
import type { YahooTokenStorage } from "../../../../../server/storage/yahoo-token-storage";
import type { YahooAppConfig } from "../../../../../server/config/config";
import { refreshAccessToken } from "../../../../../server/fantasy/yahoo/yahoo-auth";
import { jsonResponse, timeoutError } from "../../../../support/fetch";
import { YahooTokenManager } from "../../../../../server/fantasy/yahoo/yahoo-token-manager";
import {
  systemClock,
  YahooReconnectRequiredError,
  YahooUnavailableError,
} from "../../../../../server/fantasy/yahoo/yahoo-request-policy";

// Mock dependencies
vi.mock("../../../../../server/fantasy/yahoo/yahoo-auth");

const YAHOO_API_BASE = "https://fantasysports.yahooapis.com/fantasy/v2";

interface NetworkDouble {
  get: ReturnType<typeof vi.fn>;
}

/**
 * Routes the global fetch to `network.get(path, { headers })`: a resolved
 * `{ data }` becomes a 200 JSON response, a rejection with `response.status`
 * becomes that HTTP status, and a rejection with a code becomes a timeout.
 */
function routeFetchTo(network: NetworkDouble): void {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const { Authorization } = init.headers as Record<string, string>;
    try {
      const result = await network.get(url.replace(YAHOO_API_BASE, ""), {
        headers: { Authorization },
      });
      return jsonResponse(result?.data);
    } catch (error) {
      const failure = error as {
        response?: { status: number; headers?: Record<string, string> };
        code?: string;
      };
      if (failure.response) {
        return jsonResponse({}, failure.response.status, failure.response.headers);
      }
      if (failure.code) {
        throw timeoutError();
      }
      throw error;
    }
  });
}

/** The client's private request method, which the transport tests call directly. */
function privateApi(client: YahooApiClient) {
  return client as unknown as {
    apiRequest(endpoint: string, params?: Record<string, string | number>): Promise<unknown>;
  };
}

describe("YahooApiClient", () => {
  const storage = {
    getYahooToken: vi.fn(),
    saveYahooToken: vi.fn(),
    deleteYahooToken: vi.fn(),
  } as unknown as YahooTokenStorage;
  const userId = "test-user-id";
  const clientId = "test-client-id";
  const clientSecret = "test-client-secret";
  const yahooApp: YahooAppConfig = {
    clientId,
    clientSecret,
    providerRedirectUri: "https://basketball.example.test/api/auth/yahoo/fantasy/callback",
    apiBaseUrl: YAHOO_API_BASE,
    oauthBaseUrl: "https://api.login.yahoo.com",
  };
  const accessToken = "test-access-token";
  const refreshToken = "test-refresh-token";
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("create", () => {
    it("should create client using the Yahoo app credentials", async () => {
      // ARRANGE
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: "token-1",
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });
      routeFetchTo({
        get: vi.fn(),
      });

      // ACT
      const client = await YahooApiClient.create(userId, storage, yahooApp);

      // ASSERT
      expect(client).toBeInstanceOf(YahooApiClient);
    });

    it("should throw error when the Yahoo app credentials are not configured", async () => {
      // ACT & ASSERT
      await expect(
        YahooApiClient.create(userId, storage, { ...yahooApp, clientId: null, clientSecret: null })
      ).rejects.toThrow("Yahoo OAuth credentials are not configured");
    });

    it("should throw error when no token available", async () => {
      // ARRANGE
      vi.mocked(storage.getYahooToken).mockResolvedValue(undefined); // No token

      // ACT & ASSERT
      await expect(YahooApiClient.create(userId, storage, yahooApp)).rejects.toBeInstanceOf(
        YahooReconnectRequiredError
      );
    });

    it("should refresh token if expired", async () => {
      // ARRANGE
      const expiredExpiresAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const newAccessToken = "new-access-token";
      const newRefreshToken = "new-refresh-token";
      const newExpiresIn = 3600;

      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: "token-1",
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
        id: "token-1",
        userId,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + newExpiresIn,
      });
      routeFetchTo({
        get: vi.fn(),
      });

      // ACT
      const client = await YahooApiClient.create(userId, storage, yahooApp);

      // ASSERT
      // Uses env credentials
      expect(refreshAccessToken).toHaveBeenCalledWith(
        refreshToken,
        clientId,
        clientSecret,
        yahooApp.providerRedirectUri
      );
      expect(storage.saveYahooToken).toHaveBeenCalled();
      expect(client).toBeInstanceOf(YahooApiClient);
    });

    it("should throw error if token refresh fails", async () => {
      // ARRANGE
      const expiredExpiresAt = Math.floor(Date.now() / 1000) - 3600;

      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: "token-1",
        userId,
        accessToken,
        refreshToken,
        expiresAt: expiredExpiresAt,
      });
      vi.mocked(refreshAccessToken).mockRejectedValue(new YahooReconnectRequiredError());

      // ACT & ASSERT
      await expect(YahooApiClient.create(userId, storage, yahooApp)).rejects.toBeInstanceOf(
        YahooReconnectRequiredError
      );
    });
  });

  describe("apiRequest", () => {
    let client: YahooApiClient;
    let network: NetworkDouble;

    beforeEach(async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: "token-1",
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      network = {
        get: vi.fn(),
      };
      routeFetchTo(network);

      client = await YahooApiClient.create(userId, storage, yahooApp);
    });

    it("reports every HTTP attempt, including retries, through onRequest", async () => {
      const onRequest = vi.fn();
      const counted = await YahooApiClient.create(userId, storage, yahooApp, undefined, onRequest);
      const unavailable = Object.assign(new Error("Service Unavailable"), {
        isAxiosError: true,
        response: { status: 503, headers: {} },
      });
      network.get.mockRejectedValueOnce(unavailable).mockResolvedValueOnce({ data: { ok: true } });

      await privateApi(counted).apiRequest("/one", undefined);

      expect(onRequest).toHaveBeenCalledTimes(2);
    });

    it("should make successful API request", async () => {
      // ARRANGE
      const endpoint = "/test/endpoint";
      const responseData = { data: "test" };
      network.get.mockResolvedValue({ data: responseData });

      // ACT
      // Access private method via type assertion for testing
      const result = await privateApi(client).apiRequest(endpoint);

      // ASSERT
      expect(network.get).toHaveBeenCalledWith(`${endpoint}?format=json`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      expect(result).toEqual(responseData);
    });

    it("decodes HTML entities in Yahoo text before returning", async () => {
      network.get.mockResolvedValue({
        data: { team: { name: "Ball don&#39;t lie", team_key: "466.l.1.t.4" } },
      });

      const result = await privateApi(client).apiRequest("/team/466.l.1.t.4");

      expect(result).toEqual({ team: { name: "Ball don't lie", team_key: "466.l.1.t.4" } });
    });

    it("should include query parameters in request", async () => {
      // ARRANGE
      const endpoint = "/test/endpoint";
      const params = { key: "value", num: 123 };
      const responseData = { data: "test" };
      network.get.mockResolvedValue({ data: responseData });

      // ACT
      const result = await privateApi(client).apiRequest(endpoint, params);

      // ASSERT
      expect(network.get).toHaveBeenCalledWith(
        expect.stringContaining("key=value"),
        expect.any(Object)
      );
      expect(network.get).toHaveBeenCalledWith(
        expect.stringContaining("num=123"),
        expect.any(Object)
      );
      expect(result).toEqual(responseData);
    });

    it("should refresh token and retry on 401 error", async () => {
      // ARRANGE
      const endpoint = "/test/endpoint";
      const newAccessToken = "new-access-token";
      const newRefreshToken = "new-refresh-token";
      const newExpiresIn = 3600;

      // First call returns 401
      const error401 = {
        response: { status: 401 },
      };
      network.get
        .mockRejectedValueOnce(error401)
        .mockResolvedValueOnce({ data: { success: true } });

      vi.mocked(refreshAccessToken).mockResolvedValue({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: newExpiresIn,
      });
      vi.mocked(storage.saveYahooToken).mockResolvedValue({
        id: "token-1",
        userId,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + newExpiresIn,
      });

      // ACT
      const result = await privateApi(client).apiRequest(endpoint);

      // ASSERT
      // Uses env credentials
      expect(refreshAccessToken).toHaveBeenCalledWith(
        refreshToken,
        clientId,
        clientSecret,
        yahooApp.providerRedirectUri
      );
      expect(network.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });

    it("should throw error if token refresh fails on 401", async () => {
      // ARRANGE
      const endpoint = "/test/endpoint";
      const error401 = {
        response: { status: 401 },
      };
      network.get.mockRejectedValueOnce(error401);

      vi.mocked(refreshAccessToken).mockRejectedValue(new YahooReconnectRequiredError());

      // ACT & ASSERT
      await expect(privateApi(client).apiRequest(endpoint)).rejects.toBeInstanceOf(
        YahooReconnectRequiredError
      );
    });

    it("should re-throw non-retryable client errors unchanged", async () => {
      // ARRANGE
      const endpoint = "/test/endpoint";
      const error404 = {
        response: { status: 404, statusText: "Not Found", data: { error: "Missing" } },
      };
      network.get.mockRejectedValueOnce(error404);

      // ACT & ASSERT
      await expect(privateApi(client).apiRequest(endpoint)).rejects.toMatchObject({
        response: { status: 404 },
      });
      expect(network.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("refresh coordination and provider failures", () => {
    const now = () => Math.floor(Date.now() / 1000);
    const expired = () => ({
      userId,
      accessToken,
      refreshToken,
      expiresAt: now() - 60,
      version: 4,
    });
    let network: { get: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      vi.mocked(storage.getYahooToken).mockReset();
      vi.mocked(storage.saveYahooToken).mockReset();
      vi.mocked(refreshAccessToken).mockReset();
      network = { get: vi.fn() };
      routeFetchTo(network);
    });

    it("keeps the current refresh token when Yahoo omits a replacement", async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue(expired());
      vi.mocked(refreshAccessToken).mockResolvedValue({
        accessToken: "rotated-access",
        expiresIn: 3600,
      });
      vi.mocked(storage.saveYahooToken).mockImplementation(async (token) => ({
        ...token,
        version: 5,
      }));

      await YahooApiClient.create(userId, storage, yahooApp);

      expect(storage.saveYahooToken).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: "rotated-access", refreshToken }),
        { expectedVersion: 4 }
      );
    });

    it("uses a rotated refresh token for the next refresh", async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue({ ...expired(), expiresAt: now() + 3600 });
      vi.mocked(refreshAccessToken)
        .mockResolvedValueOnce({
          accessToken: "access-2",
          refreshToken: "refresh-2",
          expiresIn: 3600,
        })
        .mockResolvedValueOnce({ accessToken: "access-3", expiresIn: 3600 });
      vi.mocked(storage.saveYahooToken).mockImplementation(async (token, options) => ({
        ...token,
        version: (options?.expectedVersion ?? 0) + 1,
      }));
      network.get
        .mockRejectedValueOnce({ response: { status: 401 } })
        .mockResolvedValueOnce({ data: "first" })
        .mockRejectedValueOnce({ response: { status: 401 } })
        .mockResolvedValueOnce({ data: "second" });
      const client = await YahooApiClient.create(userId, storage, yahooApp);

      await privateApi(client).apiRequest("/one");
      await privateApi(client).apiRequest("/two");

      expect(vi.mocked(refreshAccessToken).mock.calls.map(([token]) => token)).toEqual([
        refreshToken,
        "refresh-2",
      ]);
      expect(storage.saveYahooToken).toHaveBeenLastCalledWith(
        expect.objectContaining({ accessToken: "access-3", refreshToken: "refresh-2" }),
        { expectedVersion: 5 }
      );
    });

    it("uses the token a concurrent request stored when Yahoo rejects the already-used refresh token", async () => {
      const refreshedElsewhere = {
        userId,
        accessToken: "refreshed-elsewhere",
        refreshToken: "rotated-refresh",
        expiresAt: now() + 3600,
        version: 6,
      };
      vi.mocked(storage.getYahooToken)
        .mockResolvedValueOnce(expired())
        .mockResolvedValueOnce(refreshedElsewhere);
      vi.mocked(refreshAccessToken).mockRejectedValue(new YahooReconnectRequiredError());

      const tokens = await YahooTokenManager.load(userId, storage, yahooApp, systemClock);

      expect(tokens.accessToken).toBe("refreshed-elsewhere");
      expect(storage.saveYahooToken).not.toHaveBeenCalled();
    });

    it("still asks to reconnect when Yahoo rejects the refresh and nothing newer is stored", async () => {
      vi.mocked(storage.getYahooToken)
        .mockResolvedValueOnce(expired())
        .mockResolvedValueOnce(expired());
      vi.mocked(refreshAccessToken).mockRejectedValue(new YahooReconnectRequiredError());

      await expect(YahooApiClient.create(userId, storage, yahooApp)).rejects.toBeInstanceOf(
        YahooReconnectRequiredError
      );
    });

    it("keeps no refresh state between clients: each one refreshes from storage", async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue(expired());
      vi.mocked(refreshAccessToken).mockResolvedValue({ accessToken: "a", expiresIn: 3600 });
      vi.mocked(storage.saveYahooToken).mockImplementation(async (token) => ({
        ...token,
        version: 5,
      }));

      await YahooApiClient.create(userId, storage, yahooApp);
      await YahooApiClient.create(userId, storage, yahooApp);

      expect(refreshAccessToken).toHaveBeenCalledTimes(2);
    });

    it("adopts the token another instance committed instead of overwriting it", async () => {
      const winner = {
        userId,
        accessToken: "winner-access",
        refreshToken,
        expiresAt: now() + 3600,
        version: 5,
      };
      vi.mocked(storage.getYahooToken)
        .mockResolvedValueOnce(expired())
        .mockResolvedValueOnce(winner);
      vi.mocked(refreshAccessToken).mockResolvedValue({
        accessToken: "late-access",
        expiresIn: 3600,
      });
      vi.mocked(storage.saveYahooToken).mockRejectedValue(
        new Error("Yahoo token changed during refresh; stale result rejected")
      );

      const tokens = await YahooTokenManager.load(userId, storage, yahooApp, systemClock);

      expect(storage.saveYahooToken).toHaveBeenCalledTimes(1);
      expect(tokens.accessToken).toBe("winner-access");
    });

    it("fails closed when the user disconnected during the refresh", async () => {
      vi.mocked(storage.getYahooToken)
        .mockResolvedValueOnce(expired())
        .mockResolvedValueOnce(undefined);
      vi.mocked(refreshAccessToken).mockResolvedValue({
        accessToken: "late-access",
        expiresIn: 3600,
      });
      vi.mocked(storage.saveYahooToken).mockRejectedValue(
        new Error("Yahoo token changed during refresh; stale result rejected")
      );

      await expect(YahooApiClient.create(userId, storage, yahooApp)).rejects.toBeInstanceOf(
        YahooReconnectRequiredError
      );
      expect(storage.saveYahooToken).toHaveBeenCalledTimes(1);
    });

    it("requires reconnecting when Yahoo still returns 401 after a refresh", async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue({ ...expired(), expiresAt: now() + 3600 });
      vi.mocked(refreshAccessToken).mockResolvedValue({
        accessToken: "new-access",
        expiresIn: 3600,
      });
      vi.mocked(storage.saveYahooToken).mockImplementation(async (token) => ({
        ...token,
        version: 5,
      }));
      network.get.mockRejectedValue({ response: { status: 401 } });
      const client = await YahooApiClient.create(userId, storage, yahooApp);

      await expect(privateApi(client).apiRequest("/endpoint")).rejects.toBeInstanceOf(
        YahooReconnectRequiredError
      );
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(network.get).toHaveBeenCalledTimes(2);
    });

    it("gives up on repeated 5xx within the request budget", async () => {
      let clockNow = Date.now();
      const clock = {
        now: () => clockNow,
        sleep: async (milliseconds: number) => {
          clockNow += milliseconds;
        },
      };
      vi.mocked(storage.getYahooToken).mockResolvedValue({ ...expired(), expiresAt: now() + 3600 });
      network.get.mockRejectedValue({ isAxiosError: true, response: { status: 503 } });
      const client = await YahooApiClient.create(userId, storage, yahooApp, clock);

      await expect(privateApi(client).apiRequest("/endpoint")).rejects.toBeInstanceOf(
        YahooUnavailableError
      );
      expect(network.get).toHaveBeenCalledTimes(3);
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("getUserGameLeagues", () => {
    let client: YahooApiClient;
    let network: NetworkDouble;

    beforeEach(async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: "token-1",
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      network = {
        get: vi.fn(),
      };
      routeFetchTo(network);

      client = await YahooApiClient.create(userId, storage, yahooApp);
    });

    it("should return leagues for game code", async () => {
      // ARRANGE
      const gameCode = "nba";

      network.get.mockResolvedValueOnce({
        data: {
          fantasy_content: {
            users: [
              {
                user: [
                  { guid: "test-guid" },
                  {
                    games: {
                      game: [
                        [
                          {
                            game_key: "466",
                            name: "Basketball",
                            code: "nba",
                          },
                          {
                            leagues: {
                              league: [
                                [
                                  {
                                    league_key: "466.l.12345",
                                    name: "Test League",
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
        league_key: "466.l.12345",
        name: "Test League",
      });
      expect(network.get).toHaveBeenCalledTimes(1);
      expect(network.get).toHaveBeenCalledWith(
        "/users;use_login=1/games;game_codes=nba/leagues?format=json",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    });

    it("should return no games if Yahoo has no leagues for the game code", async () => {
      // ARRANGE
      const gameCode = "invalid";

      network.get.mockResolvedValueOnce({
        data: {
          fantasy_content: {
            users: [
              {
                user: [
                  { guid: "test-guid" },
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
        guid: "test-guid",
        games: [{ leagues: [] }],
      });
      expect(network.get).toHaveBeenCalledWith(
        "/users;use_login=1/games;game_codes=invalid/leagues?format=json",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    });
  });

  describe("League resource methods", () => {
    let client: YahooApiClient;
    let network: NetworkDouble;

    beforeEach(async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: "token-1",
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      network = {
        get: vi.fn(),
      };
      routeFetchTo(network);

      client = await YahooApiClient.create(userId, storage, yahooApp);
    });

    it("should get league standings", async () => {
      // ARRANGE
      const leagueKey = "466.l.12345";
      const standingsData = { standings: "data" };
      network.get.mockResolvedValue({ data: standingsData });

      // ACT
      const result = await client.getLeagueStandings(leagueKey);

      // ASSERT
      expect(network.get).toHaveBeenCalledWith(
        expect.stringContaining(`/league/${leagueKey}/standings`),
        expect.any(Object)
      );
      expect(result).toEqual(standingsData);
    });
  });

  describe("Team resource methods", () => {
    let client: YahooApiClient;
    let network: NetworkDouble;

    beforeEach(async () => {
      vi.mocked(storage.getYahooToken).mockResolvedValue({
        id: "token-1",
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      });

      network = {
        get: vi.fn(),
      };
      routeFetchTo(network);

      client = await YahooApiClient.create(userId, storage, yahooApp);
    });

    it("should get team roster without week", async () => {
      // ARRANGE
      const teamKey = "466.l.12345.t.1";
      const rosterData = { roster: "data" };
      network.get.mockResolvedValue({ data: rosterData });

      // ACT
      const result = await client.getTeamRoster(teamKey);

      // ASSERT
      expect(network.get).toHaveBeenCalledWith(
        expect.stringContaining(`/team/${teamKey}/roster`),
        expect.any(Object)
      );
      expect(result).toEqual(rosterData);
    });

    it("should get team roster with week", async () => {
      // ARRANGE
      const teamKey = "466.l.12345.t.1";
      const week = 5;
      const rosterData = { roster: "data" };
      network.get.mockResolvedValue({ data: rosterData });

      // ACT
      const result = await client.getTeamRoster(teamKey, week);

      // ASSERT
      expect(network.get).toHaveBeenCalledWith(
        expect.stringContaining(`/team/${teamKey}/roster`),
        expect.any(Object)
      );
      expect(network.get).toHaveBeenCalledWith(
        expect.stringContaining(`week=${week}`),
        expect.any(Object)
      );
      expect(result).toEqual(rosterData);
    });
  });
});
