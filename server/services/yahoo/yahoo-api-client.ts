/**
 * Direct Yahoo Fantasy API Client
 * Endpoint methods over the token manager and transport.
 */

import type { YahooAppConfig } from "../../config/config";
import type { YahooTokenStorage } from "../../storage/yahoo-token-storage";
import { systemClock, type YahooRequestClock } from "./yahoo-request-policy";
import { YahooTokenManager, type TokenRefresher } from "./yahoo-token-manager";
import { YahooTransport } from "./yahoo-transport";
import type { FetchFunction } from "./provider-http";
import { logger } from "../../utils/logger";

export class YahooApiClient {
  private constructor(private readonly transport: YahooTransport) {}

  /**
   * Create a YahooApiClient for a user from the Yahoo app's credentials,
   * which the composition root provides.
   */
  static async create(
    userId: string,
    tokenStorage: YahooTokenStorage,
    app: YahooAppConfig,
    clock: YahooRequestClock = systemClock,
    onRequest: () => void = () => {},
    network: { fetchFunction?: FetchFunction; refresher?: TokenRefresher } = {}
  ): Promise<YahooApiClient> {
    const tokens = await YahooTokenManager.load(
      userId,
      tokenStorage,
      app,
      clock,
      network.refresher
    );
    return new YahooApiClient(new YahooTransport(tokens, clock, onRequest, network.fetchFunction));
  }

  private apiRequest<T = any>(
    endpoint: string,
    params?: Record<string, string | number>
  ): Promise<T> {
    return this.transport.get<T>(endpoint, params);
  }

  /**
   * User resource methods
   */
  /**
   * Get all leagues across all games without needing a specific game code
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
    } else if (users && typeof users === "object") {
      // Try users.user first (simple object format)
      if (users.user) {
        userData = users.user;
      }
      // Try users['0'] or users[0] (numeric string key format)
      else if (users["0"]?.user) {
        userData = users["0"].user;
      } else if (users[0]?.user) {
        userData = users[0].user;
      }
    }

    if (!userData) {
      logger.debug("getAllUserLeagues: No users in response or invalid format", {
        usersType: typeof users,
        usersIsArray: Array.isArray(users),
        usersKeys: users && typeof users === "object" ? Object.keys(users) : undefined,
      });
      return { games: [], guid: undefined };
    }

    if (!userData || !Array.isArray(userData) || userData.length < 2) {
      logger.debug("getAllUserLeagues: Invalid user data structure", {
        userDataType: typeof userData,
        isArray: Array.isArray(userData),
        length: userData?.length,
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
    const gameKeys = Object.keys(gamesData).filter((key) => key !== "count" && !isNaN(Number(key)));
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
          gameType: typeof game,
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
        leaguesDataKeys:
          leaguesData && typeof leaguesData === "object" ? Object.keys(leaguesData) : undefined,
      });

      if (!leaguesData) {
        logger.debug("getAllUserLeagues: No leagues data found", { gameProps });
        return { ...gameProps, leagues: [] };
      }

      // Handle leagues structure - can be numeric string keys like {"0": {league: [...]}, "1": {league: [...]}}
      let leagues: any[] = [];

      // First, try to collect all leagues from numeric string keys
      const leagueKeys = Object.keys(leaguesData).filter(
        (key) => key !== "count" && !isNaN(Number(key))
      );
      logger.debug("getAllUserLeagues: Found league keys", {
        leagueKeys,
        count: leaguesData.count,
      });

      if (leagueKeys.length > 0) {
        // Leagues are stored under numeric string keys
        for (const key of leagueKeys) {
          const leagueEntry = leaguesData[key];
          logger.debug("getAllUserLeagues: Processing league entry", {
            key,
            hasLeague: !!leagueEntry?.league,
            leagueIsArray: Array.isArray(leagueEntry?.league),
            leagueType: typeof leagueEntry?.league,
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
        leaguesSample:
          leagues.length > 0 ? JSON.stringify(leagues[0]).substring(0, 200) : undefined,
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
            draft_status: leagueProps?.draft_status,
            start_date: leagueProps?.start_date,
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
          draft_status: league?.draft_status,
          start_date: league?.start_date,
        };
      });

      logger.debug("getAllUserLeagues: Parsed leagues", {
        gameCode: gameProps?.code,
        parsedLeaguesCount: parsedLeagues.length,
        parsedLeagues: parsedLeagues,
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
      `/users;use_login=1/games;game_codes=${encodeURIComponent(gameCode)}/leagues`
    );

    // Parse the raw Yahoo API response
    const users = response?.fantasy_content?.users;

    // Handle both array and object formats for users
    // Yahoo API can return: users: [{ user: [...] }] or users: { '0': { user: [...] }, count: ... }
    let userData: any = null;
    if (Array.isArray(users) && users.length > 0) {
      // Format: users: [{ user: [...] }]
      userData = users[0]?.user;
    } else if (users && typeof users === "object") {
      // Try users.user first (simple object format)
      if (users.user) {
        userData = users.user;
      }
      // Try users['0'] or users[0] (numeric string key format)
      else if (users["0"]?.user) {
        userData = users["0"].user;
      } else if (users[0]?.user) {
        userData = users[0].user;
      }
    }

    if (!userData) {
      logger.debug("getUserGameLeagues: No users in response or invalid format", {
        usersType: typeof users,
        usersIsArray: Array.isArray(users),
        usersKeys: users && typeof users === "object" ? Object.keys(users) : undefined,
      });
      return { games: [], guid: undefined };
    }

    if (!userData || !Array.isArray(userData) || userData.length < 2) {
      logger.debug("getUserGameLeagues: Invalid user data structure", {
        userDataType: typeof userData,
        isArray: Array.isArray(userData),
        length: userData?.length,
      });
      return { games: [], guid: userData?.[0]?.guid };
    }

    const gamesData = userData[1]?.games;
    if (!gamesData) {
      logger.debug("getUserGameLeagues: No games data", {
        userDataKeys: Object.keys(userData[1] || {}),
        userDataLength: userData.length,
      });
      return { games: [], guid: userData[0]?.guid };
    }

    logger.debug("getUserGameLeagues: Games data structure", {
      gamesDataType: typeof gamesData,
      gamesDataKeys: Object.keys(gamesData),
      gamesDataCount: gamesData.count,
      sampleGameEntry: gamesData["0"]
        ? JSON.stringify(gamesData["0"]).substring(0, 300)
        : undefined,
    });

    // Handle games structure - can be numeric string keys like {"0": {game: [...]}, "1": {game: [...]}}
    let games: any[] = [];

    // First, try to collect all games from numeric string keys
    const gameKeys = Object.keys(gamesData).filter((key) => key !== "count" && !isNaN(Number(key)));
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
          gameType: typeof game,
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
        leaguesDataKeys:
          leaguesData && typeof leaguesData === "object" ? Object.keys(leaguesData) : undefined,
      });

      if (!leaguesData) {
        logger.debug("getUserGameLeagues: No leagues data found", { gameProps });
        return { ...gameProps, leagues: [] };
      }

      // Handle leagues structure - can be numeric string keys like {"0": {league: [...]}, "1": {league: [...]}}
      let leagues: any[] = [];

      // First, try to collect all leagues from numeric string keys
      const leagueKeys = Object.keys(leaguesData).filter(
        (key) => key !== "count" && !isNaN(Number(key))
      );
      logger.debug("getUserGameLeagues: Found league keys", {
        leagueKeys,
        count: leaguesData.count,
      });

      if (leagueKeys.length > 0) {
        // Leagues are stored under numeric string keys
        for (const key of leagueKeys) {
          const leagueEntry = leaguesData[key];
          logger.debug("getUserGameLeagues: Processing league entry", {
            key,
            hasLeague: !!leagueEntry?.league,
            leagueIsArray: Array.isArray(leagueEntry?.league),
            leagueType: typeof leagueEntry?.league,
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
        leaguesSample:
          leagues.length > 0 ? JSON.stringify(leagues[0]).substring(0, 200) : undefined,
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
            draft_status: leagueProps?.draft_status,
            start_date: leagueProps?.start_date,
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
          draft_status: league?.draft_status,
          start_date: league?.start_date,
        };
      });

      logger.debug("getUserGameLeagues: Parsed leagues", {
        gameCode: gameProps?.code,
        parsedLeaguesCount: parsedLeagues.length,
        parsedLeagues: parsedLeagues,
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
    const endpoint = week ? `/team/${teamKey}/roster;week=${week}` : `/team/${teamKey}/roster`;
    return this.apiRequest(endpoint);
  }
}
