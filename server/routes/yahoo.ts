import type { Express } from "express";
import { requireAuth } from "../middleware/auth";
import { requireYahooAuth } from "../middleware/yahoo-auth";
import { yahooController } from "../controllers/yahoo-controller";
import { getYahooApiClient } from "../services/yahoo/yahoo-api-client";
import { getAuthenticatedUserId } from "../middleware/auth";
import { asyncHandler } from "../middleware/error-handler";

/** Register Yahoo Fantasy API data routes */
export function registerYahooRoutes(app: Express): void {
  app.get(
    "/api/yahoo/leagues",
    requireAuth,
    requireYahooAuth,
    yahooController.getLeagues
  );
  app.get(
    "/api/yahoo/roster-by-team/:teamKey",
    requireAuth,
    requireYahooAuth,
    yahooController.getRoster
  );
  
  // Test endpoint to verify Yahoo API authentication
  app.get(
    "/api/yahoo/test-auth",
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      try {
        const client = await getYahooApiClient(userId);
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
