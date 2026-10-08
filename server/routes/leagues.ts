import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import type { createLeagueController } from "../controllers/league-controller";

/** What the league routes need. */
export interface LeagueRouteDependencies {
  readonly requireAuth: RequestHandler;
  /** Per-user request limit; runs after requireAuth. */
  readonly dataLimiter: RequestHandler;
  /** Limits refreshing the league list from Yahoo; runs after requireAuth. */
  readonly leagueRefreshLimiter: RequestHandler;
  readonly controller: ReturnType<typeof createLeagueController>;
}

/** Register the league-scope endpoint. */
export function registerLeagueRoutes(
  app: Express,
  { requireAuth, dataLimiter, leagueRefreshLimiter, controller }: LeagueRouteDependencies
): void {
  // Only a refresh costs Yahoo calls, so only a refresh counts against the refresh limit.
  const limitRefreshes = (req: Request, res: Response, next: NextFunction) =>
    req.query.refresh === "true" ? leagueRefreshLimiter(req, res, next) : next();
  app.get("/api/leagues", requireAuth, dataLimiter, limitRefreshes, controller.listLeagues);
  app.get("/api/leagues/:key/teams/:team/roster", requireAuth, dataLimiter, controller.getRoster);
  app.get("/api/leagues/:key/:scope", requireAuth, dataLimiter, controller.getLeagueScope);
}
