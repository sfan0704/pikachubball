/**
 * Direct Yahoo Fantasy API Client
 * Makes HTTP calls directly to Yahoo Fantasy API without using the yahoo-fantasy library
 */

import axios, { AxiosInstance } from "axios";
import { storage } from "../../storage";
import { decrypt } from "../../utils/encryption";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { refreshAccessToken } from "../../yahoo-auth";

const YAHOO_API_BASE = "https://fantasysports.yahooapis.com/fantasy/v2";

/**
 * Yahoo API Client that handles authentication and makes direct API calls
 */
export class YahooApiClient {
  private userId: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private axiosInstance: AxiosInstance;

  private constructor(userId: string, clientId: string, clientSecret: string) {
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
   * Requires user-provided credentials (no app-level fallback)
   */
  static async create(userId: string): Promise<YahooApiClient> {
    // Require user-provided credentials
    const credentials = await storage.getYahooCredentials(userId);
    if (!credentials) {
      throw new Error("Yahoo OAuth credentials are required. Please add your Client ID and Client Secret in Settings.");
    }

    const clientId = decrypt(credentials.encryptedClientId);
    const clientSecret = decrypt(credentials.encryptedClientSecret);

    if (!clientId || !clientSecret) {
      throw new Error("Yahoo OAuth credentials are invalid. Please update your credentials in Settings.");
    }

    const client = new YahooApiClient(userId, clientId, clientSecret);
    await client.initializeTokens();
    return client;
  }

  /**
   * Initialize tokens from storage and refresh if expired
   */
  private async initializeTokens(): Promise<void> {
    const tokenData = await storage.getYahooToken(this.userId);
    if (!tokenData) {
      throw new Error("No valid Yahoo access token available. Please reconnect your Yahoo account.");
    }

    const now = Math.floor(Date.now() / 1000);
    let accessToken = tokenData.accessToken;
    let refreshToken = tokenData.refreshToken;

    // Check if token is expired and refresh if needed
    if (tokenData.expiresAt <= now && refreshToken) {
      logger.info("Access token expired, refreshing...", { 
        userId: this.userId, 
        expiresAt: tokenData.expiresAt, 
        now 
      });
      
      try {
        const newTokens = await refreshAccessToken(refreshToken, this.clientId, this.clientSecret);
        const newExpiresAt = Math.floor(Date.now() / 1000) + newTokens.expiresIn;
        
        await storage.saveYahooToken({
          userId: this.userId,
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresAt: newExpiresAt,
        });
        
        accessToken = newTokens.accessToken;
        refreshToken = newTokens.refreshToken;
        
        logger.info("Token refreshed successfully", { userId: this.userId });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Failed to refresh expired token:", {
          userId: this.userId,
          errorMessage,
        });
        throw new Error("Yahoo access token expired and refresh failed. Please reconnect your Yahoo account.");
      }
    }

    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * Make an authenticated API request to Yahoo Fantasy API
   * Automatically handles token refresh on 401 errors
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

    try {
      const response = await this.axiosInstance.get(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      // If we get a 401, try refreshing the token once
      if (error.response?.status === 401 && this.refreshToken) {
        logger.debug("Got 401, attempting token refresh", { userId: this.userId, endpoint });
        
        try {
          const newTokens = await refreshAccessToken(this.refreshToken, this.clientId, this.clientSecret);
          const newExpiresAt = Math.floor(Date.now() / 1000) + newTokens.expiresIn;
          
          await storage.saveYahooToken({
            userId: this.userId,
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresAt: newExpiresAt,
          });
          
          this.accessToken = newTokens.accessToken;
          this.refreshToken = newTokens.refreshToken;
          
          // Retry the request with new token
          const response = await this.axiosInstance.get(url, {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
            },
          });
          
          return response.data;
        } catch (refreshError: any) {
          logger.error("Token refresh failed during API request:", {
            userId: this.userId,
            error: refreshError.message,
          });
          throw new Error("Yahoo access token expired and refresh failed. Please reconnect your Yahoo account.");
        }
      }

      // Re-throw other errors
      logger.error("Yahoo API request failed:", {
        userId: this.userId,
        endpoint,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw error;
    }
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
    // First get the game key for the game code
    const gamesResponse = await this.getUserGames();
    const game = gamesResponse.games?.find((g: any) => g.code === gameCode);
    
    if (!game) {
      throw new Error(`Game code ${gameCode} not found`);
    }

    const gameKey = game.game_key;
    const response = await this.apiRequest(`/users;use_login=1/games;game_keys=${gameKey}/leagues`);
    
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
      return { games: [], guid: gamesResponse.guid };
    }
    
    if (!userData || !Array.isArray(userData) || userData.length < 2) {
      logger.debug("getUserGameLeagues: Invalid user data structure", {
        userDataType: typeof userData,
        isArray: Array.isArray(userData),
        length: userData?.length
      });
      return { games: [], guid: gamesResponse.guid };
    }
    
    const gamesData = userData[1]?.games;
    if (!gamesData) {
      logger.debug("getUserGameLeagues: No games data", {
        userDataKeys: Object.keys(userData[1] || {}),
        userDataLength: userData.length
      });
      return { games: [], guid: gamesResponse.guid };
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
      guid: userData[0]?.guid || gamesResponse.guid,
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
export async function getYahooApiClient(userId: string): Promise<YahooApiClient> {
  return YahooApiClient.create(userId);
}

