import type { Request, Response } from "express";
import { getAuthenticatedUserId } from "../middleware/auth";
import { asyncHandler, ValidationError } from "../middleware/error-handler";
import { getUserLeagues } from "../services/yahoo/league-service";
import { getTeamRoster } from "../services/yahoo/roster-service";
import { logger } from "../utils/logger";

/**
 * Yahoo Fantasy API controller
 * Thin HTTP adapter for Yahoo Fantasy data fetching
 */
export const yahooController = {
  /**
   * Get all user's leagues and teams
   */
  getLeagues: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }
    
    try {
      const leagues = await getUserLeagues(userId);
      logger.info("Returning leagues to client", {
        userId,
        leaguesCount: leagues.length,
        leagues: leagues.map(l => ({ leagueKey: l.leagueKey, leagueName: l.leagueName, teamKey: l.teamKey, teamName: l.teamName }))
      });
      res.json({ leagues });
    } catch (error: any) {
      // Log detailed error for debugging
      logger.error("Error in getLeagues controller:", {
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }),

  /**
   * Get roster for a specific team
   */
  getRoster: asyncHandler(async (req: Request, res: Response) => {
    const { teamKey } = req.params;
    if (!teamKey) {
      throw new ValidationError("Team key required");
    }

    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }
    const roster = await getTeamRoster(userId, teamKey);
    res.json({ roster });
  }),
};

