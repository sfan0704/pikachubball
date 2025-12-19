import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "./error-handler";

/**
 * Middleware to require authentication for protected routes
 * Returns 401 if user is not authenticated
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ 
      error: "Authentication required",
      code: "UNAUTHORIZED"
    });
    return;
  }
  next();
}

/**
 * Get the authenticated user's ID
 * 
 * Use this AFTER requireAuth middleware - it assumes user is authenticated.
 * Throws UnauthorizedError if user is not authenticated (defensive check).
 * 
 * @throws {UnauthorizedError} If user is not authenticated
 */
export function getAuthenticatedUserId(req: Request): string {
  if (!req.isAuthenticated() || !req.user) {
    // This should never happen if requireAuth was used, but defensive check
    throw new UnauthorizedError("User not authenticated");
  }
  return (req.user as { id: string }).id;
}

/**
 * Get the authenticated user object
 * 
 * Use this AFTER requireAuth middleware - it assumes user is authenticated.
 * Throws UnauthorizedError if user is not authenticated (defensive check).
 * 
 * @throws {UnauthorizedError} If user is not authenticated
 */
export function getAuthenticatedUser(req: Request): { id: string; username: string } {
  if (!req.isAuthenticated() || !req.user) {
    throw new UnauthorizedError("User not authenticated");
  }
  return req.user as { id: string; username: string };
}

/**
 * Get the authenticated user's ID (optional)
 * 
 * Use this for routes where authentication is optional (e.g., public routes that
 * provide enhanced features for authenticated users). Returns null if user is not authenticated.
 * 
 * Example use cases:
 * - Public API endpoints that show different data for logged-in users
 * - Routes that work for both authenticated and anonymous users
 * - Features that are optional but enhanced when authenticated
 * 
 * @param req Express request object
 * @returns User ID if authenticated, null otherwise
 */
export function getOptionalUserId(req: Request): string | null {
  if (!req.isAuthenticated() || !req.user) {
    return null;
  }
  return (req.user as { id: string }).id;
}

