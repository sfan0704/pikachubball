import type { Request, Response } from "express";
import { YahooFantasyDataSource } from "../services/fantasy-data-source";
import { getLeagueRankings, getLeagueHeatmap } from "../services/viz/league-viz";
import { getMatchupComparison } from "../services/viz/matchup-viz";
import { getAuthenticatedUserId } from "../middleware/auth";
import { parseWeekParam } from "../utils/week-parser";
import { asyncHandler } from "../middleware/error-handler";
import { UnauthorizedError, ValidationError } from "../../shared/api/errors";
import type { YahooClientFactory } from "../services/yahoo/yahoo-api-client";

/**
 * Visualization controller
 * Handles retained league rankings and matchup visualizations.
 */
export interface VizControllerDependencies {
  readonly createYahooClient: YahooClientFactory;
}

export function createVizController({ createYahooClient }: VizControllerDependencies) {
  /** A data source for the signed-in user, or UNAUTHORIZED when storage is missing. */
  const dataSourceFor = (req: Request, userId: string) => {
    if (!req.ownerStorage) {
      throw new UnauthorizedError("Owner-scoped storage is unavailable");
    }
    return new YahooFantasyDataSource(userId, req.ownerStorage, createYahooClient);
  };

  return {
    /**
     * Get league rankings (9-category standings)
     */
    getLeagueRankings: asyncHandler(async (req: Request, res: Response) => {
      const { leagueKey } = req.params;
      if (!leagueKey) {
        throw new ValidationError("League key required");
      }

      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        throw new ValidationError("Authentication required");
      }

      const week = parseWeekParam(req.query.week);
      const dataSource = dataSourceFor(req, userId);
      const response = await getLeagueRankings(dataSource, leagueKey, week);

      res.json(response);
    }),

    /**
     * Get league heatmap visualization
     */
    getLeagueHeatmap: asyncHandler(async (req: Request, res: Response) => {
      const { leagueKey } = req.params;
      if (!leagueKey) {
        throw new ValidationError("League key required");
      }

      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        throw new ValidationError("Authentication required");
      }

      const week = parseWeekParam(req.query.week);
      const dataSource = dataSourceFor(req, userId);
      const response = await getLeagueHeatmap(dataSource, leagueKey, week);

      res.json(response);
    }),

    /**
     * Get matchup comparison visualization
     */
    getMatchupComparison: asyncHandler(async (req: Request, res: Response) => {
      const { leagueKey, teamKey } = req.params;
      if (!leagueKey || !teamKey) {
        throw new ValidationError("League key and team key required");
      }

      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        throw new ValidationError("Authentication required");
      }

      const week = parseWeekParam(req.query.week);
      const opponentTeamKey = req.query.opponentTeamKey as string | undefined;
      const dataSource = dataSourceFor(req, userId);
      const response = await getMatchupComparison(
        dataSource,
        leagueKey,
        teamKey,
        week,
        opponentTeamKey
      );

      res.json(response);
    }),
  };
}
