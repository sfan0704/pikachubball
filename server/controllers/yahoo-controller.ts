import type { Request, Response } from "express";
import { getAuthenticatedUserId } from "../middleware/auth";
import { asyncHandler } from "../middleware/error-handler";
import { UnauthorizedError, ValidationError } from "../../shared/api/errors";
import { getUserLeagues } from "../services/yahoo/league-service";
import { getTeamRoster } from "../services/yahoo/roster-service";
import type { YahooClientFactory } from "../services/yahoo/yahoo-api-client";
import type { Logger } from "../utils/logger";

/**
 * Yahoo Fantasy API controller
 * Thin HTTP adapter for Yahoo Fantasy data fetching
 */
export interface YahooControllerDependencies {
  readonly logger: Logger;
  readonly createYahooClient: YahooClientFactory;
}

export function createYahooController({ logger, createYahooClient }: YahooControllerDependencies) {
  return {
  /**
   * Get all user's leagues and teams
   */
  getLeagues: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }
    
    const storage = req.ownerStorage;
    if (!storage) {
      throw new UnauthorizedError("Owner-scoped storage is unavailable");
    }

    try {
      const leagues = await getUserLeagues(userId, storage, createYahooClient);
      await storage.replaceFantasyMemberships(
        leagues.map(({ leagueKey, teamKey }) => ({ leagueKey, teamKey })),
      );
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
    const storage = req.ownerStorage;
    if (!storage) {
      throw new UnauthorizedError("Owner-scoped storage is unavailable");
    }
    const roster = await getTeamRoster(userId, teamKey, storage, createYahooClient);
    res.json({ roster });
  }),
  };
}
