import type { Express, RequestHandler } from "express";
import type { createDailyStatsController } from "../controllers/daily-stats-controller";

/** What the daily-stats routes need. */
export interface DailyStatsRouteDependencies {
  readonly requireAuth: RequestHandler;
  /** Per-user request limit; runs after requireAuth. */
  readonly dataLimiter: RequestHandler;
  readonly controller: ReturnType<typeof createDailyStatsController>;
}

/**
 * Register one endpoint per daily-stats dataset. They go before the league
 * scope route, whose `:scope` would otherwise take "games", "players" and the rest.
 */
export function registerDailyStatsRoutes(
  app: Express,
  { requireAuth, dataLimiter, controller }: DailyStatsRouteDependencies
): void {
  const guard = [requireAuth, dataLimiter];
  app.get("/api/leagues/:key/teams/:team/days/:date", ...guard, controller.getTeamDay);
  app.get("/api/leagues/:key/teams/:team/transactions", ...guard, controller.getTransactions);
  app.get("/api/leagues/:key/games", ...guard, controller.getGameLogs);
  app.get("/api/leagues/:key/player-stats/:period", ...guard, controller.getPlayerStats);
  app.get("/api/leagues/:key/players", ...guard, controller.listPlayers);
  app.get("/api/leagues/:key/schedule", ...guard, controller.getSchedule);
  app.get("/api/leagues/:key/draft", ...guard, controller.getDraft);
  app.get("/api/leagues/:key/weeks", ...guard, controller.getWeeks);
}
