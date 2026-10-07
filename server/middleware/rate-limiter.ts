import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/api/errors";
import { env } from "../config/env";

/**
 * Skip rate limiting in development mode
 * This avoids validation errors and makes local development easier
 */
const skipInDevelopment = (_req: Request, _res: Response) => {
  return env.NODE_ENV === "development";
};

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

/**
 * General API rate limiter
 * Applies to all API endpoints
 * Disabled in development mode
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  handler: rateLimited("Too many requests from this IP, please try again later"),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment, // Skip rate limiting in development
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks on login
 * Disabled in development mode
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window per IP
  handler: rateLimited("Too many login attempts, please try again later"),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment, // Skip rate limiting in development
});

/**
 * Very strict rate limiter for signup
 * Prevents account creation abuse
 * Disabled in development mode
 */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 signups per hour per IP
  handler: rateLimited("Too many signup attempts, please try again later"),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment, // Skip rate limiting in development
});

