import type { Express } from "express";
import { supabaseAuthController } from "../controllers/supabase-auth-controller";
import { requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/rate-limiter";

/**
 * Register the Yahoo-only Supabase authentication boundary.
 */
export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/yahoo", authLimiter, supabaseAuthController.beginYahooLogin);
  app.get("/api/auth/callback", supabaseAuthController.completeYahooLogin);
  app.post("/api/auth/logout", supabaseAuthController.logout);
  app.get("/api/auth/me", requireAuth, supabaseAuthController.getCurrentUser);
}
