import type { Express } from "express";
import { requireAuth } from "../middleware/auth";
import { authController } from "../controllers/auth-controller";
import { asyncHandler } from "../middleware/error-handler";
import { authLimiter, signupLimiter } from "../middleware/rate-limiter";

/**
 * Register basic authentication routes (signup, login, logout, me)
 * These are the core user authentication endpoints
 */
export function registerAuthRoutes(app: Express): void {
  // Public routes with rate limiting
  app.post("/api/auth/signup", signupLimiter, authController.signup);
  app.post("/api/auth/login", authLimiter, authController.login);

  // Protected routes
  app.post("/api/auth/logout", requireAuth, authController.logout);
  app.get("/api/auth/me", requireAuth, authController.getCurrentUser);
}
