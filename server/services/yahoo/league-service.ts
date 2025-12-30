import { getYahooApiClient } from "./yahoo-api-client";
import { logger } from "../../utils/logger";
import { parseTeamsFromStandings } from "../parsers/league-parser.js";

/**
 * League Service
 * Business logic for league-related operations using direct Yahoo API calls
 */

export interface LeagueWithTeam {
  leagueKey: string;
  leagueName: string;
  teamKey: string;
  teamName: string;
  season?: number; // Season year (e.g., 2024, 2025)
  gameKey?: string; // Game key (e.g., "466" for NBA 2024-25)
}

/**
 * Get all user's leagues with their teams
 * Optimized with parallel API calls
 */
export async function getUserLeagues(userId: string): Promise<LeagueWithTeam[]> {
  const client = await getYahooApiClient(userId);

  try {
    // Get user games to extract GUID, then fetch NBA leagues only
    logger.debug("Fetching user games for NBA leagues");
    const allGames = await client.getUserGames();
    const userGuid = allGames?.guid;

    // Try to get NBA leagues directly
    let userData;
    try {
      logger.debug("Fetching NBA leagues");
      userData = await client.getUserGameLeagues("nba");
    } catch (error: any) {
      // If getUserGameLeagues fails, try getAllUserLeagues and filter for NBA
      logger.debug("getUserGameLeagues failed, trying getAllUserLeagues", { error: error.message });
      try {
        userData = await client.getAllUserLeagues();
        // Filter to only NBA games
        if (userData?.games && Array.isArray(userData.games)) {
          userData.games = userData.games.filter((game: any) => game.code === "nba");
        }
      } catch (fallbackError: any) {
        logger.warn("Failed to fetch NBA leagues", { 
          error: error.message,
          fallbackError: fallbackError.message
        });
        return [];
      }
    }
    
    logger.debug("getUserLeagues: User data received", {
      hasGames: !!userData?.games,
      gamesIsArray: Array.isArray(userData?.games),
      gamesCount: userData?.games?.length || 0,
      games: userData?.games?.map((g: any) => ({
        code: g.code,
        game_key: g.game_key,
        name: g.name,
        leaguesCount: g.leagues?.length || 0,
        leagues: g.leagues?.map((l: any) => ({ league_key: l.league_key, name: l.name })) || []
      })) || []
    });
    
    if (!userData?.games || !Array.isArray(userData.games) || userData.games.length === 0) {
      logger.warn("No NBA games found for user", { 
        allGamesResponse: allGames,
        userDataResponse: userData 
      });
      return [];
    }

    // Use guid from userData if available, otherwise from allGames
    const finalUserGuid = userData.guid || userGuid;

    if (!finalUserGuid) {
      logger.warn("No user GUID found", { userData, allGames });
      return [];
    }

    // Extract league keys from NBA games only
    const leagueKeys: string[] = [];
    const leagueMap = new Map<string, { leagueKey: string; leagueName: string; season?: number; gameKey?: string }>();

    for (const game of userData.games) {
      // Handle both array format [gameProps, leaguesData] and direct object format
      const gameProps = Array.isArray(game) ? game[0] : game;
      
      // Only process NBA games
      if (gameProps?.code !== "nba" && game.code !== "nba") {
        logger.debug("getUserLeagues: Skipping non-NBA game", { 
          code: gameProps?.code || game.code 
        });
        continue;
      }
      
      // Filter out inactive games (game over or offseason)
      const isGameOver = gameProps?.is_game_over === 1 || gameProps?.is_game_over === true;
      const isOffseason = gameProps?.is_offseason === 1 || gameProps?.is_offseason === true;
      
      if (isGameOver || isOffseason) {
        logger.debug("getUserLeagues: Skipping inactive game", {
          gameKey: gameProps?.game_key || game.game_key,
          isGameOver,
          isOffseason
        });
        continue;
      }
      
      // Extract season from game (could be string or number)
      const gameSeason = gameProps?.season ? parseInt(String(gameProps.season), 10) : (game.season ? parseInt(String(game.season), 10) : undefined);
      const gameKey = gameProps?.game_key || game.game_key;
      
      logger.debug("getUserLeagues: Processing active NBA game", {
        gameKey: game.game_key,
        season: gameSeason,
        hasLeagues: !!game.leagues,
        leaguesIsArray: Array.isArray(game.leagues),
        leaguesCount: game.leagues?.length || 0
      });
      
      if (game.leagues && Array.isArray(game.leagues)) {
        for (const league of game.leagues) {
          // Filter out finished leagues
          const isFinished = league.is_finished === 1 || league.is_finished === true;
          
          // Check if league is still in progress (current_week <= end_week)
          const currentWeek = league.current_week ? parseInt(String(league.current_week), 10) : undefined;
          const endWeek = league.end_week ? parseInt(String(league.end_week), 10) : undefined;
          const isInProgress = currentWeek !== undefined && endWeek !== undefined && currentWeek <= endWeek;
          
          if (isFinished) {
            logger.debug("getUserLeagues: Skipping finished league", {
              league_key: league.league_key,
              name: league.name,
              is_finished: league.is_finished
            });
            continue;
          }
          
          if (!isInProgress && currentWeek !== undefined && endWeek !== undefined) {
            logger.debug("getUserLeagues: Skipping league past end week", {
              league_key: league.league_key,
              name: league.name,
              current_week: currentWeek,
              end_week: endWeek
            });
            continue;
          }
          
          logger.debug("getUserLeagues: Processing active league", {
            league_key: league.league_key,
            name: league.name,
            current_week: currentWeek,
            end_week: endWeek,
            is_finished: league.is_finished
          });
          
          if (league.league_key && league.name) {
            leagueKeys.push(league.league_key);
            leagueMap.set(league.league_key, {
              leagueKey: league.league_key,
              leagueName: league.name,
              season: gameSeason,
              gameKey: gameKey,
            });
          } else {
            logger.warn("getUserLeagues: League missing required fields", { league });
          }
        }
      } else {
        logger.warn("getUserLeagues: Game has no leagues or leagues is not an array", {
          gameKey: game.game_key,
          leagues: game.leagues,
          leaguesType: typeof game.leagues
        });
      }
    }
    
    logger.debug("getUserLeagues: Extracted league keys", {
      leagueKeysCount: leagueKeys.length,
      leagueKeys: leagueKeys
    });

    if (leagueKeys.length === 0) {
      return [];
    }

    // Fetch all standings in parallel
    const standingsPromises = leagueKeys.map((leagueKey) =>
      client.getLeagueStandings(leagueKey).catch((error) => {
        logger.warn(`Failed to fetch standings for league ${leagueKey}:`, error);
        return null;
      })
    );

    const standingsResults = await Promise.all(standingsPromises);

    // Process standings to find user's team
    const leagues: LeagueWithTeam[] = [];

    for (let i = 0; i < leagueKeys.length; i++) {
      const leagueKey = leagueKeys[i];
      const standingsResult = standingsResults[i];
      const leagueInfo = leagueMap.get(leagueKey);

      if (!standingsResult || !leagueInfo) {
        continue;
      }

      // Parse standings from raw Yahoo API response
      const standingsData = standingsResult?.fantasy_content?.league;
      if (!standingsData || !Array.isArray(standingsData) || standingsData.length < 2) {
        continue;
      }

      const standings = standingsData[1]?.standings;
      if (!standings || !Array.isArray(standings) || standings.length === 0) {
        continue;
      }

      // Use parser to get all teams
      const teams = parseTeamsFromStandings({ standings }, leagueKey);
      
      // Find user's team by GUID
      const userTeam = teams.find(team => team.managerGuid === finalUserGuid);
      
      if (userTeam) {
        leagues.push({
          leagueKey: leagueInfo.leagueKey,
          leagueName: leagueInfo.leagueName,
          teamKey: userTeam.teamKey,
          teamName: userTeam.teamName,
          season: leagueInfo.season,
          gameKey: leagueInfo.gameKey,
        });
      }
    }

    return leagues;
  } catch (error: any) {
    logger.error("Error getting user leagues:", {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
    });
    if (
      error.message?.includes("credentials") ||
      error.message?.includes("refresh") ||
      error.message?.includes("token")
    ) {
      throw new Error(
        "Yahoo Fantasy credentials expired or invalid. Please reconnect your Yahoo account."
      );
    }
    // Provide more detailed error message
    const errorMsg = error.response?.data?.error_description 
      || error.response?.data?.error
      || error.message
      || "Failed to retrieve leagues from Yahoo Fantasy API";
    throw new Error(`Failed to get leagues: ${errorMsg}`);
  }
}

