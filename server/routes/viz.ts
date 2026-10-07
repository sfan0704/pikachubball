import type { Express, RequestHandler } from "express";
import { requireOwnedFantasyResource } from "../middleware/fantasy-resource";
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
    requireOwnedFantasyResource,
    controller.getLeagueRankings
  );
  app.get(
    "/api/viz/heatmap/:leagueKey",
    requireAuth,
    requireOwnedFantasyResource,
    controller.getLeagueHeatmap
  );
  app.get(
    "/api/viz/matchup/:leagueKey/:teamKey",
    requireAuth,
    requireOwnedFantasyResource,
    controller.getMatchupComparison
  );
}
