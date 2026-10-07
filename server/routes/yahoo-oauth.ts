import type { Express, RequestHandler } from "express";
import type { createYahooOAuthController } from "../controllers/yahoo-oauth-controller";

/** What the Yahoo OAuth routes need. */
export interface YahooOAuthRouteDependencies {
  readonly requireAuth: RequestHandler;
  readonly controller: ReturnType<typeof createYahooOAuthController>;
}

/**
 * Register Yahoo OAuth utility routes
 * Note: Main Yahoo login flow is handled by /api/auth/yahoo routes in auth.ts
 * These routes provide status checking and token management
 */
export function registerYahooOAuthRoutes(app: Express, { requireAuth, controller }: YahooOAuthRouteDependencies): void {
  app.get(
    "/connect/start",
    requireAuth,
    controller.beginFantasyAccess,
  );
  app.get(
    "/api/auth/yahoo/fantasy/callback",
    requireAuth,
    controller.completeFantasyAccess,
  );
  // OAuth status and token management
  app.get(
    "/api/auth/yahoo/status",
    requireAuth,
    controller.getStatus
  );
  app.delete(
    "/api/auth/yahoo/disconnect",
    requireAuth,
    controller.disconnect
  );
}
