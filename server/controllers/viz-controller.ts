import type { Request, Response } from "express";
import { YahooFantasyDataSource } from "../services/fantasy-data-source";
import { getLeagueRankings, getLeagueHeatmap } from "../services/viz/league-viz";
import { getMatchupComparison } from "../services/viz/matchup-viz";
import { getScheduleMatrix } from "../services/viz/schedule-viz";
import { getAuthenticatedUserId } from "../middleware/auth";
import { parseWeekParam } from "../utils/week-parser";
import { asyncHandler, ValidationError } from "../middleware/error-handler";

/**
 * Visualization controller
 * Handles league rankings, matchups, and schedule visualizations
 */
export const vizController = {
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
    const dataSource = new YahooFantasyDataSource(userId);
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
    const dataSource = new YahooFantasyDataSource(userId);
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
    const dataSource = new YahooFantasyDataSource(userId);
    const response = await getMatchupComparison(
      dataSource,
      leagueKey,
      teamKey,
      week,
      opponentTeamKey
    );

    res.json(response);
  }),

  /**
   * Get schedule matrix visualization
   */
  getScheduleMatrix: asyncHandler(async (req: Request, res: Response) => {
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
    const dataSource = new YahooFantasyDataSource(userId);
    const response = await getScheduleMatrix(
      dataSource,
      leagueKey,
      teamKey,
      week,
      opponentTeamKey
    );

    res.json(response);
  }),
};

