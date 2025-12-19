import type { Express } from "express";
import { requireAuth } from "../middleware/auth";
import { yahooOAuthController } from "../controllers/yahoo-oauth-controller";

/** Register Yahoo OAuth routes */
export function registerYahooOAuthRoutes(app: Express): void {
  // Optional credential management (users can provide their own for rate limits/privacy)
  app.post(
    "/api/settings/yahoo-credentials",
    requireAuth,
    yahooOAuthController.saveCredentials
  );
  app.get(
    "/api/settings/yahoo-credentials",
    requireAuth,
    yahooOAuthController.getCredentials
  );
  app.delete(
    "/api/settings/yahoo-credentials",
    requireAuth,
    yahooOAuthController.deleteCredentials
  );

  // OAuth flow
  app.get("/api/auth/yahoo", requireAuth, yahooOAuthController.getAuthUrl);
  app.get(
    "/api/auth/yahoo/callback",
    yahooOAuthController.handleCallback
  );
  app.get(
    "/api/auth/yahoo/status",
    requireAuth,
    yahooOAuthController.getStatus
  );
  app.delete(
    "/api/auth/yahoo",
    requireAuth,
    yahooOAuthController.disconnect
  );
}
