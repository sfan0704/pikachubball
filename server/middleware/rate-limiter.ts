import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/api/errors";

/** Options the composition root chooses from configuration. */
export interface RateLimiterOptions {
  /** Skip all limits (local development, where they only get in the way). */
  readonly skip: boolean;
}

/** Passes a RATE_LIMITED error to the error handler, which sets Retry-After. */
function rateLimited(message: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : undefined;
    next(new AppError("RATE_LIMITED", message, retryAfterSeconds === undefined ? undefined : { retryAfterSeconds }));
  };
}

/** Builds the rate limiters the routes use. */
export function createRateLimiters({ skip }: RateLimiterOptions) {
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
  };
}
