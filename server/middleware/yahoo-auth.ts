import type { Request, Response, NextFunction } from "express";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./error-handler";
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
    if (!req.ownerStorage) {
      throw new UnauthorizedError("Owner-scoped storage is unavailable");
    }
    const token = await req.ownerStorage.getYahooToken(userId);
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

export function leagueKeyFromTeamKey(teamKey: string): string | null {
  const match = /^(.*\.l\.[^.]+)\.t\.[^.]+$/.exec(teamKey);
  return match?.[1] ?? null;
}

/** Reject Yahoo resource keys that are not linked to the authenticated owner. */
export async function requireOwnedFantasyResource(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.ownerStorage) {
      throw new UnauthorizedError("Owner-scoped storage is unavailable");
    }
    const teamKey = req.params.teamKey;
    const leagueKey = req.params.leagueKey ??
      (teamKey ? leagueKeyFromTeamKey(teamKey) : null);
    if (!leagueKey) {
      throw new ValidationError("A valid Yahoo league key is required");
    }
    if (!(await req.ownerStorage.ownsFantasyResource(leagueKey, teamKey))) {
      throw new ForbiddenError("Yahoo league or team is not linked to this account");
    }
    next();
  } catch (error) {
    next(error);
  }
}
