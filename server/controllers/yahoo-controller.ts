import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/error-handler";
import { ValidationError } from "../../shared/api/errors";
import { getRequestContext } from "../request-context";
import { getUserLeagues } from "../services/yahoo/league-service";
import { getTeamRoster } from "../services/yahoo/roster-service";

/**
 * Yahoo Fantasy API controller
 * Thin HTTP adapter for Yahoo Fantasy data fetching
 */
export function createYahooController() {
  return {
    /**
     * Get all user's leagues and teams
     */
    getLeagues: asyncHandler(async (req: Request, res: Response) => {
      const context = getRequestContext(req);
      const leagues = await getUserLeagues(context.yahooClient);
      await context.storage.replaceFantasyMemberships(
        leagues.map(({ leagueKey, teamKey }) => ({ leagueKey, teamKey }))
      );
      context.logger.info("Returning leagues to client", { leaguesCount: leagues.length });
      res.json({ leagues });
    }),

    /**
     * Get roster for a specific team
     */
    getRoster: asyncHandler(async (req: Request, res: Response) => {
      const { teamKey } = req.params;
      if (!teamKey) {
        throw new ValidationError("Team key required");
      }

      const context = getRequestContext(req);
      const roster = await getTeamRoster(teamKey, context.yahooClient);
      res.json({ roster });
    }),
  };
}
