import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { NotFoundError, UnauthorizedError } from "./error-handler";
import { getAuthenticatedUserId } from "./auth";

/**
 * Middleware to validate Yahoo Fantasy authentication
 * Verifies that user has a valid Yahoo token
 * 
 * Usage:
 *   app.get("/api/endpoint", requireAuth, requireYahooAuth, handler);
 */
export async function requireYahooAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new UnauthorizedError("Authentication required");
    }

    // Get Yahoo token to verify connection exists
    const token = await storage.getYahooToken(userId);
    if (!token) {
      throw new NotFoundError("Yahoo Fantasy connection. Please connect your Yahoo account first.");
    }

    // Token validation happens when API client is created
    // Just verify it exists here
    next();
  } catch (error) {
    next(error);
  }
}

