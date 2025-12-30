import type { Express } from "express";
import { requireAuth } from "../middleware/auth";
import { authController } from "../controllers/auth-controller";
import { yahooSocialController } from "../controllers/yahoo-social-controller";
import { authLimiter } from "../middleware/rate-limiter";

/**
 * Register authentication routes (login, logout, me)
 * Primary authentication is via Yahoo Social Login
 * Admin login available via username/password
 */
export function registerAuthRoutes(app: Express): void {
  // Yahoo Social Login routes (primary authentication method)
  app.get("/api/auth/yahoo", authLimiter, yahooSocialController.initiateLogin);
  app.get("/api/auth/yahoo/callback", yahooSocialController.handleCallback);

  // Admin login with rate limiting (username/password for admins only)
  app.post("/api/auth/login", authLimiter, authController.login);

  // Protected routes
  app.post("/api/auth/logout", requireAuth, authController.logout);
  app.get("/api/auth/me", requireAuth, authController.getCurrentUser);
}
