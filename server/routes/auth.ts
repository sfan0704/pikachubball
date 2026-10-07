import type { Express, RequestHandler } from "express";
import type { createSupabaseAuthController } from "../controllers/supabase-auth-controller";

/** What the sign-in routes need. */
export interface AuthRouteDependencies {
  readonly requireAuth: RequestHandler;
  readonly authLimiter: RequestHandler;
  readonly controller: ReturnType<typeof createSupabaseAuthController>;
}

/**
 * Register the Yahoo-only Supabase authentication boundary.
 */
export function registerAuthRoutes(
  app: Express,
  { requireAuth, authLimiter, controller }: AuthRouteDependencies
): void {
  app.get("/api/auth/yahoo", authLimiter, controller.beginYahooLogin);
  app.get("/api/auth/callback", controller.completeYahooLogin);
  app.post("/api/auth/logout", controller.logout);
  app.get("/api/auth/me", requireAuth, controller.getCurrentUser);
}
