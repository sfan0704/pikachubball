import rateLimit from "express-rate-limit";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../../shared/api/errors";
import type { createYahooOAuthController } from "../controllers/yahoo-oauth-controller";
import { getRequestContext } from "../request-context";

/** Starts and finishes of the Fantasy connection a user may make per minute. */
export const FANTASY_CONNECTIONS_PER_MINUTE = 10;

/** What the Yahoo OAuth routes need. */
export interface YahooOAuthRouteDependencies {
  readonly requireAuth: RequestHandler;
  /** Skip the limit (local development). */
  readonly skipRateLimit: boolean;
  readonly controller: ReturnType<typeof createYahooOAuthController>;
}

/**
 * Register the Fantasy access routes. The sign-in itself is in auth.ts; these
 * connect the Fantasy API after it, and are limited per signed-in user.
 */
export function registerYahooOAuthRoutes(
  app: Express,
  { requireAuth, skipRateLimit, controller }: YahooOAuthRouteDependencies
): void {
  const connectLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: FANTASY_CONNECTIONS_PER_MINUTE,
    keyGenerator: (req) => getRequestContext(req).user.userId,
    handler: (_req: Request, _res: Response, next: NextFunction) =>
      next(new AppError("RATE_LIMITED", "Too many connection attempts, try again in a minute")),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => skipRateLimit,
  });

  app.get("/connect/start", requireAuth, connectLimiter, controller.beginFantasyAccess);
  app.get(
    "/api/auth/yahoo/fantasy/callback",
    requireAuth,
    connectLimiter,
    controller.completeFantasyAccess
  );
}
