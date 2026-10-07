import type { Express, RequestHandler } from "express";
import { requireOwnedFantasyResource, requireYahooAuth } from "../middleware/yahoo-auth";
import type { createYahooController } from "../controllers/yahoo-controller";
import type { YahooClientFactory } from "../services/yahoo/yahoo-api-client";
import { getAuthenticatedUserId } from "../middleware/auth";
import { asyncHandler } from "../middleware/error-handler";
import { UnauthorizedError } from "../../shared/api/errors";

/** What the Yahoo data routes need. */
export interface YahooRouteDependencies {
  readonly requireAuth: RequestHandler;
  readonly controller: ReturnType<typeof createYahooController>;
  readonly createYahooClient: YahooClientFactory;
}

/** Register Yahoo Fantasy API data routes */
export function registerYahooRoutes(
  app: Express,
  { requireAuth, controller, createYahooClient }: YahooRouteDependencies
): void {
  app.get("/api/yahoo/leagues", requireAuth, requireYahooAuth, controller.getLeagues);
  app.get(
    "/api/yahoo/roster-by-team/:teamKey",
    requireAuth,
    requireYahooAuth,
    requireOwnedFantasyResource,
    controller.getRoster
  );

  // Test endpoint to verify Yahoo API authentication (removed by CAR-84)
  app.get(
    "/api/yahoo/test-auth",
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = getAuthenticatedUserId(req);
      if (!req.ownerStorage) {
        throw new UnauthorizedError();
      }

      try {
        const client = await createYahooClient(userId, req.ownerStorage);
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
