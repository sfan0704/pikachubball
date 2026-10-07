import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../../shared/api/errors";
import { readVerifiedYahooIdentity, type YahooSessionIdentity } from "../auth/supabase-auth";
import type { ServerDependencies } from "../dependencies";
import type { OwnerScopedStorage } from "../storage/yahoo-token-storage";

declare module "express-serve-static-core" {
  interface Request {
    authIdentity?: YahooSessionIdentity;
    ownerStorage?: OwnerScopedStorage;
  }
}

/** Collaborators the sign-in check needs. */
export type RequireAuthDependencies = Pick<ServerDependencies, "createSupabaseClient" | "createOwnerStorage">;

/**
 * Builds the middleware that requires a verified Supabase session. It sets
 * the request's identity and owner-scoped storage, or passes UNAUTHORIZED on.
 */
export function createRequireAuth(dependencies: RequireAuthDependencies) {
  return async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.authIdentity) {
      next();
      return;
    }
    try {
      const client = dependencies.createSupabaseClient(req, res);
      req.authIdentity = await readVerifiedYahooIdentity(client);
      req.ownerStorage = dependencies.createOwnerStorage(client, req.authIdentity.userId);
      next();
    } catch {
      next(new UnauthorizedError());
    }
  };
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
  if (!req.authIdentity) {
    throw new UnauthorizedError("User not authenticated");
  }
  return req.authIdentity.userId;
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
  if (!req.authIdentity) {
    throw new UnauthorizedError("User not authenticated");
  }
  return {
    id: req.authIdentity.userId,
    username: req.authIdentity.yahooGuid,
  };
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
  return req.authIdentity?.userId ?? null;
}
