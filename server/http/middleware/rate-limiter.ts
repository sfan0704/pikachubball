import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../shared/api/errors";
import { getRequestContext } from "../request-context";

/** Per-user requests a minute that protect the shared Yahoo rate limit. */
export const DATA_REQUESTS_PER_MINUTE = 60;
/** League-list refreshes from Yahoo a user may trigger per minute. */
export const LEAGUE_REFRESHES_PER_MINUTE = 1;

/** Options the composition root chooses from configuration. */
export interface RateLimiterOptions {
  /** Skip all limits (local development, where they only get in the way). */
  readonly skip: boolean;
  /** Overrides the per-minute limits; tests use small ones. */
  readonly limits?: { readonly data?: number; readonly leagueRefresh?: number };
}

/** Passes a RATE_LIMITED error to the error handler, which sets Retry-After. */
function rateLimited(message: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : undefined;
    next(
      new AppError(
        "RATE_LIMITED",
        message,
        retryAfterSeconds === undefined ? undefined : { retryAfterSeconds }
      )
    );
  };
}

/** Counts a signed-in user's requests; must run after requireAuth. Keyed by user, never by IP. */
function perUserPerMinute(limit: number, skip: boolean, message: string) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    keyGenerator: (req) => getRequestContext(req).user.userId,
    handler: rateLimited(message),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => skip,
  });
}

/** Builds the rate limiters the routes use; each keeps its own counts. */
export function createRateLimiters({ skip, limits }: RateLimiterOptions) {
  return {
    /** Strict limit on sign-in attempts: 5 per 15 minutes per IP; successful sign-ins don't count. */
    auth: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      handler: rateLimited("Too many login attempts, please try again later"),
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => skip,
    }),
    /** Per-user limit on data routes, which protects the shared Yahoo rate limit. */
    data: perUserPerMinute(
      limits?.data ?? DATA_REQUESTS_PER_MINUTE,
      skip,
      "Too many requests, please try again in a minute"
    ),
    /** Per-user limit on refreshing the league list from Yahoo. */
    leagueRefresh: perUserPerMinute(
      limits?.leagueRefresh ?? LEAGUE_REFRESHES_PER_MINUTE,
      skip,
      "Leagues were just refreshed, please try again in a minute"
    ),
  };
}
