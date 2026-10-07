import type { Express, RequestHandler } from "express";
import { requireOwnedFantasyResource } from "../middleware/fantasy-resource";
import type { createYahooController } from "../controllers/yahoo-controller";
import { asyncHandler } from "../middleware/error-handler";
import { getRequestContext } from "../request-context";

/** What the Yahoo data routes need. */
export interface YahooRouteDependencies {
  readonly requireAuth: RequestHandler;
  readonly controller: ReturnType<typeof createYahooController>;
}

/** Register Yahoo Fantasy API data routes */
export function registerYahooRoutes(
  app: Express,
  { requireAuth, controller }: YahooRouteDependencies
): void {
  app.get("/api/yahoo/leagues", requireAuth, controller.getLeagues);
  app.get(
    "/api/yahoo/roster-by-team/:teamKey",
    requireAuth,
    requireOwnedFantasyResource,
    controller.getRoster
  );

  // Test endpoint to verify Yahoo API authentication (removed by CAR-84)
  app.get(
    "/api/yahoo/test-auth",
    requireAuth,
    asyncHandler(async (req, res) => {
      try {
        const client = await getRequestContext(req).yahooClient();
        const games = await client.getUserGames();
        res.json({
          success: true,
          data: games,
        });
      } catch (error: any) {
        res.json({
          success: false,
          error: error.message || "Unknown error",
        });
      }
    })
  );
}
