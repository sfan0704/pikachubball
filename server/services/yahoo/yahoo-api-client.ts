/**
 * Direct Yahoo Fantasy API Client
 * Makes HTTP calls directly to Yahoo Fantasy API without using the yahoo-fantasy library
 */

import axios, { AxiosInstance } from "axios";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { refreshAccessToken } from "../../yahoo-auth";
import type {
  StoredYahooToken,
  YahooTokenStorage,
} from "../../storage/yahoo-token-storage";
import {
  providerStatus,
  systemClock,
  withYahooRetries,
  YAHOO_TOTAL_BUDGET_MS,
  YahooReconnectRequiredError,
  type YahooRequestClock,
} from "./yahoo-request-policy";

const YAHOO_API_BASE = "https://fantasysports.yahooapis.com/fantasy/v2";

/**
 * One refresh per user per server instance: concurrent requests await the same
 * exchange instead of spending the refresh token twice. Across instances the
 * storage compare-and-swap decides the winner (see refreshTokens).
 */
const refreshesInFlight = new Map<string, Promise<StoredYahooToken>>();

/**
 * Yahoo API Client that handles authentication and makes direct API calls
 */
export class YahooApiClient {
  private userId: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenVersion: number | undefined;
  private axiosInstance: AxiosInstance;

  private constructor(
    userId: string,
    clientId: string,
    clientSecret: string,
    private readonly tokenStorage: YahooTokenStorage,
    private readonly clock: YahooRequestClock,
  ) {
    this.userId = userId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    
    this.axiosInstance = axios.create({
      baseURL: YAHOO_API_BASE,
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Create a YahooApiClient instance for a user
   * Uses app-level credentials from environment variables
   */
  static async create(
    userId: string,
    tokenStorage?: YahooTokenStorage,
    clock: YahooRequestClock = systemClock,
  ): Promise<YahooApiClient> {
    // Use app-level credentials from environment variables
    const clientId = env.YAHOO_CLIENT_ID;
    const clientSecret = env.YAHOO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Yahoo OAuth credentials are not configured. Please set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET environment variables.");
    }
    if (!tokenStorage) {
      throw new Error("Owner-scoped Yahoo token storage is required");
    }

    const client = new YahooApiClient(userId, clientId, clientSecret, tokenStorage, clock);
    await client.initializeTokens();
    return client;
  }

  private nowSeconds(): number {
    return Math.floor(this.clock.now() / 1000);
  }

  private adopt(token: StoredYahooToken): void {
    this.accessToken = token.accessToken;
    this.refreshToken = token.refreshToken;
    this.tokenVersion = token.version;
  }

  /**
   * Initialize tokens from storage and refresh if expired
   */
  private async initializeTokens(): Promise<void> {
    const tokenData = await this.tokenStorage.getYahooToken(this.userId);
    if (!tokenData) {
      throw new YahooReconnectRequiredError();
    }

    this.adopt(tokenData);
    if (tokenData.expiresAt <= this.nowSeconds()) {
      logger.info("Yahoo access token expired, refreshing", { userId: this.userId });
      await this.refreshTokens();
    }
  }

  /**
   * Refreshes the access token, sharing an in-flight refresh for this user.
   */
  private async refreshTokens(): Promise<void> {
    let pending = refreshesInFlight.get(this.userId);
    if (!pending) {
      pending = this.exchangeAndStore().finally(() => {
        refreshesInFlight.delete(this.userId);
      });
      refreshesInFlight.set(this.userId, pending);
    }
    this.adopt(await pending);
  }

  private async exchangeAndStore(): Promise<StoredYahooToken> {
    const currentRefreshToken = this.refreshToken;
    const expectedVersion = this.tokenVersion;
    if (!currentRefreshToken) {
      throw new YahooReconnectRequiredError();
    }

    const refreshed = await refreshAccessToken(
      currentRefreshToken,
      this.clientId,
      this.clientSecret,
    );
    const rotation = {
      userId: this.userId,
      accessToken: refreshed.accessToken,
      // Yahoo may omit the refresh token; the current one stays valid then.
      refreshToken: refreshed.refreshToken ?? currentRefreshToken,
      expiresAt: this.nowSeconds() + refreshed.expiresIn,
    };

    try {
      return await this.tokenStorage.saveYahooToken(rotation, { expectedVersion });
    } catch (error) {
      if (!(error instanceof Error) || !/stale result rejected/.test(error.message)) {
        throw error;
      }
      // Another instance committed a newer token, or the user disconnected.
      // Never write over either: use the committed token or fail closed.
      const latest = await this.tokenStorage.getYahooToken(this.userId);
      if (
        latest &&
        latest.version !== undefined &&
        expectedVersion !== undefined &&
        latest.version > expectedVersion &&
        latest.expiresAt > this.nowSeconds()
      ) {
        return latest;
      }
      throw new YahooReconnectRequiredError();
    }
  }

  /**
   * Make an authenticated API request to Yahoo Fantasy API within the request
   * budget. A 401 triggers one refresh and one retry of the request.
   */
  private async apiRequest<T = any>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
    if (!this.accessToken) {
      await this.initializeTokens();
    }

    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, String(value));
      });
    }
    queryParams.append('format', 'json');

    const url = `${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const deadline = this.clock.now() + YAHOO_TOTAL_BUDGET_MS;
    const get = (timeout: number) =>
      this.axiosInstance.get(url, {
        timeout,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

    try {
      const response = await withYahooRetries(get, this.clock, deadline);
      return response.data;
    } catch (error) {
      if (providerStatus(error) !== 401) {
        this.logFailure(endpoint, error);
        throw error;
      }
    }

    logger.debug("Got 401, attempting token refresh", { userId: this.userId, endpoint });
    await this.refreshTokens();
    try {
      const response = await withYahooRetries(get, this.clock, deadline);
      return response.data;
    } catch (error) {
      if (providerStatus(error) === 401) {
        throw new YahooReconnectRequiredError();
      }
      this.logFailure(endpoint, error);
      throw error;
    }
  }

  private logFailure(endpoint: string, error: unknown): void {
    logger.error("Yahoo API request failed:", {
      userId: this.userId,
      endpoint,
      status: providerStatus(error),
      code: error instanceof Error ? (error as { code?: string }).code ?? error.name : undefined,
    });
  }

  /**
   * User resource methods
   */
  async getUserGames(): Promise<any> {
    const response = await this.apiRequest("/users;use_login=1/games");
    
    // Log raw response for debugging when games are empty
    const users = response?.fantasy_content?.users;
    
    // Handle both array and object formats for users
    // Yahoo API can return: users: [{ user: [...] }] or users: { '0': { user: [...] }, count: ... }
    let userData: any = null;
    if (Array.isArray(users) && users.length > 0) {
      // Format: users: [{ user: [...] }]
      userData = users[0]?.user;
    } else if (users && typeof users === 'object') {
      // Try users.user first (simple object format)
      if (users.user) {
        userData = users.user;
      } 
      // Try users['0'] or users[0] (numeric string key format)
      else if (users['0']?.user) {
        userData = users['0'].user;
      } else if (users[0]?.user) {
        userData = users[0].user;
      }
    }
    
    if (!userData) {
      // Log the actual structure to help debug
      const usersInfo: any = {
        type: typeof users,
        isArray: Array.isArray(users),
        isNull: users === null,
        isUndefined: users === undefined
      };
      if (users && typeof users === 'object') {
        usersInfo.keys = Object.keys(users);
        // Log a sample of the structure (first level only)
        usersInfo.sample = JSON.stringify(users).substring(0, 500);
      }
      
      logger.debug("getUserGames: No users in response or invalid format", { 
        responseKeys: Object.keys(response || {}),
        fantasyContentKeys: Object.keys(response?.fantasy_content || {}),
        usersInfo
      });
      return { games: [] };
    }
    
    if (!userData || !Array.isArray(userData) || userData.length < 2) {
      logger.debug("getUserGames: Invalid user data structure", { 
        userDataType: typeof userData,
        isArray: Array.isArray(userData),
        length: userData?.length,
        userDataKeys: userData && !Array.isArray(userData) ? Object.keys(userData) : undefined,
        userDataValue: userData
      });
      return { games: [] };
    }
    
    const gamesData = userData[1]?.games;
    if (!gamesData) {
      logger.debug("getUserGames: No games data", { 
        userDataKeys: Object.keys(userData[1] || {}),
        userDataLength: userData.length
      });
      return { games: [] };
    }
    
    // Handle games structure - can be numeric string keys like {"0": {game: [...]}, "1": {game: [...]}}
    let games: any[] = [];
    
    // First, try to collect all games from numeric string keys
    const gameKeys = Object.keys(gamesData).filter(key => key !== 'count' && !isNaN(Number(key)));
    if (gameKeys.length > 0) {
      // Games are stored under numeric string keys
      // Each gameEntry.game is an array: [gameProps, leaguesData]
      for (const key of gameKeys) {
        const gameEntry = gamesData[key];
        if (gameEntry?.game) {
          // gameEntry.game is already an array [gameProps, leaguesData], push it as-is
          if (Array.isArray(gameEntry.game)) {
            games.push(gameEntry.game); // Push the entire array, don't spread it!
          } else {
            games.push(gameEntry.game);
          }
        }
      }
    }
    // Fallback to direct game property
    else if (Array.isArray(gamesData.game)) {
      // gamesData.game might be an array of game arrays, or a single game array
      // Check if first element is an array (meaning it's [[gameProps, leaguesData], ...])
      if (gamesData.game.length > 0 && Array.isArray(gamesData.game[0])) {
        games = gamesData.game; // Already array of game arrays
      } else {
        games = [gamesData.game]; // Single game array, wrap it
      }
    } else if (gamesData.game) {
      games = [gamesData.game];
    }
    
    if (games.length === 0) {
      logger.debug("getUserGames: Games array is empty", {
        gamesDataType: typeof gamesData.game,
        gamesDataKeys: Object.keys(gamesData),
        gamesDataCount: gamesData.count,
        gameKeys
      });
    }
    
    return {
      guid: userData[0]?.guid,
      games: games.map((g: any) => ({
        game_key: g.game_key,
        name: g.name,
        code: g.code,
        season: g.season,
      })),
    };
  }

  /**
   * Get all leagues across all games without needing a specific game code
   * This is useful when getUserGames() returns empty
   */
  async getAllUserLeagues(): Promise<any> {
    const response = await this.apiRequest("/users;use_login=1/games/leagues");
    
    // Parse the raw Yahoo API response
    const users = response?.fantasy_content?.users;
    
    // Handle both array and object formats for users
    // Yahoo API can return: users: [{ user: [...] }] or users: { '0': { user: [...] }, count: ... }
    let userData: any = null;
    if (Array.isArray(users) && users.length > 0) {
      // Format: users: [{ user: [...] }]
      userData = users[0]?.user;
    } else if (users && typeof users === 'object') {
      // Try users.user first (simple object format)
      if (users.user) {
        userData = users.user;
      } 
      // Try users['0'] or users[0] (numeric string key format)
      else if (users['0']?.user) {
        userData = users['0'].user;
      } else if (users[0]?.user) {
        userData = users[0].user;
      }
    }
    
    if (!userData) {
      logger.debug("getAllUserLeagues: No users in response or invalid format", {
        usersType: typeof users,
        usersIsArray: Array.isArray(users),
        usersKeys: users && typeof users === 'object' ? Object.keys(users) : undefined
      });
      return { games: [], guid: undefined };
    }
    
    if (!userData || !Array.isArray(userData) || userData.length < 2) {
      logger.debug("getAllUserLeagues: Invalid user data structure", {
        userDataType: typeof userData,
        isArray: Array.isArray(userData),
        length: userData?.length
      });
      return { games: [], guid: userData?.[0]?.guid };
    }
    
    const gamesData = userData[1]?.games;
    if (!gamesData) {
      return { games: [], guid: userData[0]?.guid };
    }
    
    // Handle games structure - can be numeric string keys like {"0": {game: [...]}, "1": {game: [...]}}
    let games: any[] = [];
    
    // First, try to collect all games from numeric string keys
    const gameKeys = Object.keys(gamesData).filter(key => key !== 'count' && !isNaN(Number(key)));
    if (gameKeys.length > 0) {
      // Games are stored under numeric string keys
      // Each gameEntry.game is an array: [gameProps, leaguesData]
      for (const key of gameKeys) {
        const gameEntry = gamesData[key];
        if (gameEntry?.game) {
          // gameEntry.game is already an array [gameProps, leaguesData], push it as-is
          if (Array.isArray(gameEntry.game)) {
            games.push(gameEntry.game); // Push the entire array, don't spread it!
          } else {
            games.push(gameEntry.game);
          }
        }
      }
    }
    // Fallback to direct game property
    else if (Array.isArray(gamesData.game)) {
      // gamesData.game might be an array of game arrays, or a single game array
      // Check if first element is an array (meaning it's [[gameProps, leaguesData], ...])
      if (gamesData.game.length > 0 && Array.isArray(gamesData.game[0])) {
        games = gamesData.game; // Already array of game arrays
      } else {
        games = [gamesData.game]; // Single game array, wrap it
      }
    } else if (gamesData.game) {
      games = [gamesData.game];
    }
    
    // Parse leagues from each game
    // Yahoo API structure: game[0] = game properties, game[1] = leagues subresource
    const parsedGames = games.map((game: any) => {
      if (!Array.isArray(game) || game.length < 2) {
        logger.debug("getAllUserLeagues: Invalid game structure", {
          isArray: Array.isArray(game),
          length: game?.length,
          gameType: typeof game
        });
        return { leagues: [] };
      }
      
      const gameProps = game[0];
      const leaguesData = game[1]?.leagues;
      
      logger.debug("getAllUserLeagues: Parsing leagues for game", {
        gameKey: gameProps?.game_key,
        gameCode: gameProps?.code,
        hasLeaguesData: !!leaguesData,
        leaguesDataType: typeof leaguesData,
        leaguesDataKeys: leaguesData && typeof leaguesData === 'object' ? Object.keys(leaguesData) : undefined
      });
      
      if (!leaguesData) {
        logger.debug("getAllUserLeagues: No leagues data found", { gameProps });
        return { ...gameProps, leagues: [] };
      }
      
      // Handle leagues structure - can be numeric string keys like {"0": {league: [...]}, "1": {league: [...]}}
      let leagues: any[] = [];
      
      // First, try to collect all leagues from numeric string keys
      const leagueKeys = Object.keys(leaguesData).filter(key => key !== 'count' && !isNaN(Number(key)));
      logger.debug("getAllUserLeagues: Found league keys", { leagueKeys, count: leaguesData.count });
      
      if (leagueKeys.length > 0) {
        // Leagues are stored under numeric string keys
        for (const key of leagueKeys) {
          const leagueEntry = leaguesData[key];
          logger.debug("getAllUserLeagues: Processing league entry", {
            key,
            hasLeague: !!leagueEntry?.league,
            leagueIsArray: Array.isArray(leagueEntry?.league),
            leagueType: typeof leagueEntry?.league
          });
          
          if (leagueEntry?.league) {
            if (Array.isArray(leagueEntry.league)) {
              leagues.push(...leagueEntry.league);
            } else {
              leagues.push(leagueEntry.league);
            }
          }
        }
      }
      // Fallback to direct league property
      else if (Array.isArray(leaguesData.league)) {
        leagues = leaguesData.league;
      } else if (leaguesData.league) {
        leagues = [leaguesData.league];
      }
      
      logger.debug("getAllUserLeagues: Extracted leagues array", {
        gameCode: gameProps?.code,
        leaguesCount: leagues.length,
        leaguesSample: leagues.length > 0 ? JSON.stringify(leagues[0]).substring(0, 200) : undefined
      });
      
      // Parse league structure: league[0] = league properties (if array), or direct object
      const parsedLeagues = leagues.map((league: any) => {
        if (Array.isArray(league) && league.length > 0) {
          // Handle array structure: league[0] = properties
          const leagueProps = Array.isArray(league[0]) 
            ? league[0].find((prop: any) => prop?.league_key) || league[0][0]
            : league[0];
          return {
            league_key: leagueProps?.league_key,
            name: leagueProps?.name,
            is_finished: leagueProps?.is_finished,
            current_week: leagueProps?.current_week,
            end_week: leagueProps?.end_week,
            game_code: leagueProps?.game_code,
          };
        }
        // Direct object structure
        return {
          league_key: league?.league_key,
          name: league?.name,
          is_finished: league?.is_finished,
          current_week: league?.current_week,
          end_week: league?.end_week,
          game_code: league?.game_code,
        };
      });
      
      logger.debug("getAllUserLeagues: Parsed leagues", {
        gameCode: gameProps?.code,
        parsedLeaguesCount: parsedLeagues.length,
        parsedLeagues: parsedLeagues
      });
      
      return {
        ...gameProps,
        leagues: parsedLeagues,
      };
    });
    
    return {
      guid: userData[0]?.guid,
      games: parsedGames,
    };
  }

  async getUserGameLeagues(gameCode: string): Promise<any> {
    // Yahoo supports filtering the games collection by code. Going directly to
    // the leagues subresource avoids a separate, broader user-games request.
    const response = await this.apiRequest(
      `/users;use_login=1/games;game_codes=${encodeURIComponent(gameCode)}/leagues`,
    );
    
    // Parse the raw Yahoo API response
    const users = response?.fantasy_content?.users;
    
    // Handle both array and object formats for users
    // Yahoo API can return: users: [{ user: [...] }] or users: { '0': { user: [...] }, count: ... }
    let userData: any = null;
    if (Array.isArray(users) && users.length > 0) {
      // Format: users: [{ user: [...] }]
      userData = users[0]?.user;
    } else if (users && typeof users === 'object') {
      // Try users.user first (simple object format)
      if (users.user) {
        userData = users.user;
      } 
      // Try users['0'] or users[0] (numeric string key format)
      else if (users['0']?.user) {
        userData = users['0'].user;
      } else if (users[0]?.user) {
        userData = users[0].user;
      }
    }
    
    if (!userData) {
      logger.debug("getUserGameLeagues: No users in response or invalid format", {
        usersType: typeof users,
        usersIsArray: Array.isArray(users),
        usersKeys: users && typeof users === 'object' ? Object.keys(users) : undefined
      });
      return { games: [], guid: undefined };
    }
    
    if (!userData || !Array.isArray(userData) || userData.length < 2) {
      logger.debug("getUserGameLeagues: Invalid user data structure", {
        userDataType: typeof userData,
        isArray: Array.isArray(userData),
        length: userData?.length
      });
      return { games: [], guid: userData?.[0]?.guid };
    }
    
    const gamesData = userData[1]?.games;
    if (!gamesData) {
      logger.debug("getUserGameLeagues: No games data", {
        userDataKeys: Object.keys(userData[1] || {}),
        userDataLength: userData.length
      });
      return { games: [], guid: userData[0]?.guid };
    }
    
    logger.debug("getUserGameLeagues: Games data structure", {
      gamesDataType: typeof gamesData,
      gamesDataKeys: Object.keys(gamesData),
      gamesDataCount: gamesData.count,
      sampleGameEntry: gamesData['0'] ? JSON.stringify(gamesData['0']).substring(0, 300) : undefined
    });
    
    // Handle games structure - can be numeric string keys like {"0": {game: [...]}, "1": {game: [...]}}
    let games: any[] = [];
    
    // First, try to collect all games from numeric string keys
    const gameKeys = Object.keys(gamesData).filter(key => key !== 'count' && !isNaN(Number(key)));
    if (gameKeys.length > 0) {
      // Games are stored under numeric string keys
      // Each gameEntry.game is an array: [gameProps, leaguesData]
      for (const key of gameKeys) {
        const gameEntry = gamesData[key];
        if (gameEntry?.game) {
          // gameEntry.game is already an array [gameProps, leaguesData], push it as-is
          if (Array.isArray(gameEntry.game)) {
            games.push(gameEntry.game); // Push the entire array, don't spread it!
          } else {
            games.push(gameEntry.game);
          }
        }
      }
    }
    // Fallback to direct game property
    else if (Array.isArray(gamesData.game)) {
      // gamesData.game might be an array of game arrays, or a single game array
      // Check if first element is an array (meaning it's [[gameProps, leaguesData], ...])
      if (gamesData.game.length > 0 && Array.isArray(gamesData.game[0])) {
        games = gamesData.game; // Already array of game arrays
      } else {
        games = [gamesData.game]; // Single game array, wrap it
      }
    } else if (gamesData.game) {
      games = [gamesData.game];
    }
    
    // Parse leagues from each game
    // Yahoo API structure: game[0] = game properties, game[1] = leagues subresource
    const parsedGames = games.map((game: any) => {
      if (!Array.isArray(game) || game.length < 2) {
        logger.debug("getUserGameLeagues: Invalid game structure", {
          isArray: Array.isArray(game),
          length: game?.length,
          gameType: typeof game
        });
        return { leagues: [] };
      }
      
      const gameProps = game[0];
      const leaguesData = game[1]?.leagues;
      
      logger.debug("getUserGameLeagues: Parsing leagues for game", {
        gameKey: gameProps?.game_key,
        gameCode: gameProps?.code,
        hasLeaguesData: !!leaguesData,
        leaguesDataType: typeof leaguesData,
        leaguesDataKeys: leaguesData && typeof leaguesData === 'object' ? Object.keys(leaguesData) : undefined
      });
      
      if (!leaguesData) {
        logger.debug("getUserGameLeagues: No leagues data found", { gameProps });
        return { ...gameProps, leagues: [] };
      }
      
      // Handle leagues structure - can be numeric string keys like {"0": {league: [...]}, "1": {league: [...]}}
      let leagues: any[] = [];
      
      // First, try to collect all leagues from numeric string keys
      const leagueKeys = Object.keys(leaguesData).filter(key => key !== 'count' && !isNaN(Number(key)));
      logger.debug("getUserGameLeagues: Found league keys", { leagueKeys, count: leaguesData.count });
      
      if (leagueKeys.length > 0) {
        // Leagues are stored under numeric string keys
        for (const key of leagueKeys) {
          const leagueEntry = leaguesData[key];
          logger.debug("getUserGameLeagues: Processing league entry", {
            key,
            hasLeague: !!leagueEntry?.league,
            leagueIsArray: Array.isArray(leagueEntry?.league),
            leagueType: typeof leagueEntry?.league
          });
          
          if (leagueEntry?.league) {
            if (Array.isArray(leagueEntry.league)) {
              leagues.push(...leagueEntry.league);
            } else {
              leagues.push(leagueEntry.league);
            }
          }
        }
      }
      // Fallback to direct league property
      else if (Array.isArray(leaguesData.league)) {
        leagues = leaguesData.league;
      } else if (leaguesData.league) {
        leagues = [leaguesData.league];
      }
      
      logger.debug("getUserGameLeagues: Extracted leagues array", {
        gameCode: gameProps?.code,
        leaguesCount: leagues.length,
        leaguesSample: leagues.length > 0 ? JSON.stringify(leagues[0]).substring(0, 200) : undefined
      });
      
      // Parse league structure: league[0] = league properties (if array), or direct object
      const parsedLeagues = leagues.map((league: any) => {
        if (Array.isArray(league) && league.length > 0) {
          // Handle array structure: league[0] = properties
          const leagueProps = Array.isArray(league[0]) 
            ? league[0].find((prop: any) => prop?.league_key) || league[0][0]
            : league[0];
          return {
            league_key: leagueProps?.league_key,
            name: leagueProps?.name,
            is_finished: leagueProps?.is_finished,
            current_week: leagueProps?.current_week,
            end_week: leagueProps?.end_week,
            game_code: leagueProps?.game_code,
          };
        }
        // Direct object structure
        return {
          league_key: league?.league_key,
          name: league?.name,
          is_finished: league?.is_finished,
          current_week: league?.current_week,
          end_week: league?.end_week,
          game_code: league?.game_code,
        };
      });
      
      logger.debug("getUserGameLeagues: Parsed leagues", {
        gameCode: gameProps?.code,
        parsedLeaguesCount: parsedLeagues.length,
        parsedLeagues: parsedLeagues
      });
      
      return {
        ...gameProps,
        leagues: parsedLeagues,
      };
    });
    
    return {
      guid: userData[0]?.guid,
      games: parsedGames,
    };
  }

  /**
   * League resource methods
   */
  async getLeagueStandings(leagueKey: string): Promise<any> {
    return this.apiRequest(`/league/${leagueKey}/standings`);
  }

  async getLeagueSettings(leagueKey: string): Promise<any> {
    return this.apiRequest(`/league/${leagueKey}/settings`);
  }

  async getLeagueScoreboard(leagueKey: string, week?: number): Promise<any> {
    const endpoint = week 
      ? `/league/${leagueKey}/scoreboard;week=${week}`
      : `/league/${leagueKey}/scoreboard`;
    return this.apiRequest(endpoint);
  }

  /**
   * Team resource methods
   */
  async getTeamRoster(teamKey: string, week?: number): Promise<any> {
    const endpoint = week
      ? `/team/${teamKey}/roster;week=${week}`
      : `/team/${teamKey}/roster`;
    return this.apiRequest(endpoint);
  }

  /**
   * Player resource methods
   */
  async getPlayerStats(playerKey: string, week?: number | string): Promise<any> {
    let endpoint = `/player/${playerKey}/stats`;
    if (week) {
      if (typeof week === 'string' && (week === 'lastweek' || week === 'lastmonth')) {
        endpoint += `;type=${week}`;
      } else {
        endpoint += `;type=week;week=${week}`;
      }
    }
    return this.apiRequest(endpoint);
  }

  /**
   * Make a raw API request (for documentation/debugging purposes)
   * Returns the unparsed API response exactly as Yahoo returns it
   */
  async getRawApiResponse(endpoint: string, params?: Record<string, string | number>): Promise<any> {
    return this.apiRequest(endpoint, params);
  }
}

/**
 * Get a YahooApiClient instance for a user
 * This is the main entry point for Yahoo API access
 */
export async function getYahooApiClient(
  userId: string,
  tokenStorage?: YahooTokenStorage,
): Promise<YahooApiClient> {
  return YahooApiClient.create(userId, tokenStorage);
}
