import type { Express, RequestHandler } from "express";
import { requireOwnedFantasyResource } from "../middleware/fantasy-resource";
import type { createYahooController } from "../controllers/yahoo-controller";

/** What the Yahoo data routes need. */
export interface YahooRouteDependencies {
  readonly requireAuth: RequestHandler;
  /** Per-user request limit; runs after requireAuth. */
  readonly dataLimiter: RequestHandler;
  readonly controller: ReturnType<typeof createYahooController>;
}

/** Register Yahoo Fantasy API data routes */
export function registerYahooRoutes(
  app: Express,
  { requireAuth, dataLimiter, controller }: YahooRouteDependencies
): void {
  app.get("/api/yahoo/leagues", requireAuth, dataLimiter, controller.getLeagues);
  app.get(
    "/api/yahoo/roster-by-team/:teamKey",
    requireAuth,
    dataLimiter,
    requireOwnedFantasyResource,
    controller.getRoster
  );
}
