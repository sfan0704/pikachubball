import type { Request, Response, NextFunction } from "express";
import { ForbiddenError, ValidationError } from "../../shared/api/errors";
import { getRequestContext } from "../request-context";

export function leagueKeyFromTeamKey(teamKey: string): string | null {
  const match = /^(.*\.l\.[^.]+)\.t\.[^.]+$/.exec(teamKey);
  return match?.[1] ?? null;
}

/** Reject Yahoo resource keys that are not linked to the authenticated owner. */
export async function requireOwnedFantasyResource(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { storage } = getRequestContext(req);
    const teamKey = req.params.teamKey;
    const leagueKey = req.params.leagueKey ?? (teamKey ? leagueKeyFromTeamKey(teamKey) : null);
    if (!leagueKey) {
      throw new ValidationError("A valid Yahoo league key is required");
    }
    if (!(await storage.ownsFantasyResource(leagueKey, teamKey))) {
      throw new ForbiddenError("Yahoo league or team is not linked to this account");
    }
    next();
  } catch (error) {
    next(error);
  }
}
