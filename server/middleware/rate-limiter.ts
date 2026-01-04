import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { env } from "../config/env";

/**
 * Skip rate limiting in development mode
 * This avoids validation errors and makes local development easier
 */
const skipInDevelopment = (_req: Request, _res: Response) => {
  return env.NODE_ENV === "development";
};

/**
 * General API rate limiter
 * Applies to all API endpoints
 * Disabled in development mode
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: {
    error: "Too many requests from this IP, please try again later",
    code: "RATE_LIMIT_EXCEEDED",
  },
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
  message: {
    error: "Too many login attempts, please try again later",
    code: "RATE_LIMIT_EXCEEDED",
  },
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
  message: {
    error: "Too many signup attempts, please try again later",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDevelopment, // Skip rate limiting in development
});

