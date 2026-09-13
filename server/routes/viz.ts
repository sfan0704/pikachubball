import type { Express } from "express";
import { requireAuth } from "../middleware/auth";
import {
  requireOwnedFantasyResource,
  requireYahooAuth,
} from "../middleware/yahoo-auth";
import { vizController } from "../controllers/viz-controller";

/** Register retained rankings and matchup visualization routes. */
export function registerVizRoutes(app: Express): void {
  app.get(
    "/api/yahoo/league-rankings/:leagueKey",
    requireAuth,
    requireYahooAuth,
    requireOwnedFantasyResource,
    vizController.getLeagueRankings
  );
  app.get(
    "/api/viz/heatmap/:leagueKey",
    requireAuth,
    requireYahooAuth,
    requireOwnedFantasyResource,
    vizController.getLeagueHeatmap
  );
  app.get(
    "/api/viz/matchup/:leagueKey/:teamKey",
    requireAuth,
    requireYahooAuth,
    requireOwnedFantasyResource,
    vizController.getMatchupComparison
  );
}
