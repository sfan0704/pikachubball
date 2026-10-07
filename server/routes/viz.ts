import type { Express, RequestHandler } from "express";
import { requireOwnedFantasyResource, requireYahooAuth } from "../middleware/yahoo-auth";
import type { createVizController } from "../controllers/viz-controller";

/** What the visualization routes need. */
export interface VizRouteDependencies {
  readonly requireAuth: RequestHandler;
  readonly controller: ReturnType<typeof createVizController>;
}

/** Register retained rankings and matchup visualization routes. */
export function registerVizRoutes(
  app: Express,
  { requireAuth, controller }: VizRouteDependencies
): void {
  app.get(
    "/api/yahoo/league-rankings/:leagueKey",
    requireAuth,
    requireYahooAuth,
    requireOwnedFantasyResource,
    controller.getLeagueRankings
  );
  app.get(
    "/api/viz/heatmap/:leagueKey",
    requireAuth,
    requireYahooAuth,
    requireOwnedFantasyResource,
    controller.getLeagueHeatmap
  );
  app.get(
    "/api/viz/matchup/:leagueKey/:teamKey",
    requireAuth,
    requireYahooAuth,
    requireOwnedFantasyResource,
    controller.getMatchupComparison
  );
}
