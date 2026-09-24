import type { Express } from "express";
import { requireAuth } from "../middleware/auth";
import { yahooOAuthController } from "../controllers/yahoo-oauth-controller";

/** 
 * Register Yahoo OAuth utility routes
 * Note: Main Yahoo login flow is handled by /api/auth/yahoo routes in auth.ts
 * These routes provide status checking and token management
 */
export function registerYahooOAuthRoutes(app: Express): void {
  // OAuth status and token management
  app.get(
    "/api/auth/yahoo/status",
    requireAuth,
    yahooOAuthController.getStatus
  );
  app.delete(
    "/api/auth/yahoo/disconnect",
    requireAuth,
    yahooOAuthController.disconnect
  );
}
