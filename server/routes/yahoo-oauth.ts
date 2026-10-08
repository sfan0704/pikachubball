import type { Express, RequestHandler } from "express";
import type { createYahooOAuthController } from "../controllers/yahoo-oauth-controller";

/** What the Yahoo OAuth routes need. */
export interface YahooOAuthRouteDependencies {
  readonly requireAuth: RequestHandler;
  readonly controller: ReturnType<typeof createYahooOAuthController>;
}

/**
 * Register the Fantasy access routes. The sign-in itself is in auth.ts; these
 * connect the Fantasy API after it.
 */
export function registerYahooOAuthRoutes(
  app: Express,
  { requireAuth, controller }: YahooOAuthRouteDependencies
): void {
  app.get("/connect/start", requireAuth, controller.beginFantasyAccess);
  app.get("/api/auth/yahoo/fantasy/callback", requireAuth, controller.completeFantasyAccess);
}
