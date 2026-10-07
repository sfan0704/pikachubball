import type { Request, Response } from "express";
import { YahooFantasyDataSource } from "../services/fantasy-data-source";
import { getLeagueRankings, getLeagueHeatmap } from "../services/viz/league-viz";
import { getMatchupComparison } from "../services/viz/matchup-viz";
import { getRequestContext } from "../request-context";
import { parseWeekParam } from "../utils/week-parser";
import { asyncHandler } from "../middleware/error-handler";
import { ValidationError } from "../../shared/api/errors";

/**
 * Visualization controller
 * Handles retained league rankings and matchup visualizations.
 */
export function createVizController() {
  /** A data source whose Yahoo client is the request's one client. */
  const dataSourceFor = (req: Request) =>
    new YahooFantasyDataSource(getRequestContext(req).yahooClient);

  return {
    /**
     * Get league rankings (9-category standings)
     */
    getLeagueRankings: asyncHandler(async (req: Request, res: Response) => {
      const { leagueKey } = req.params;
      if (!leagueKey) {
        throw new ValidationError("League key required");
      }

      const week = parseWeekParam(req.query.week);
      const dataSource = dataSourceFor(req);
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

      const week = parseWeekParam(req.query.week);
      const dataSource = dataSourceFor(req);
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

      const week = parseWeekParam(req.query.week);
      const opponentTeamKey = req.query.opponentTeamKey as string | undefined;
      const dataSource = dataSourceFor(req);
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
