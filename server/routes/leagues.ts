import type { Express, RequestHandler } from "express";
import type { createLeagueController } from "../controllers/league-controller";

/** What the league routes need. */
export interface LeagueRouteDependencies {
  readonly requireAuth: RequestHandler;
  /** Per-user request limit; runs after requireAuth. */
  readonly dataLimiter: RequestHandler;
  readonly controller: ReturnType<typeof createLeagueController>;
}

/** Register the league-scope endpoint. */
export function registerLeagueRoutes(
  app: Express,
  { requireAuth, dataLimiter, controller }: LeagueRouteDependencies
): void {
  app.get("/api/leagues/:key/:scope", requireAuth, dataLimiter, controller.getLeagueScope);
}
