import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";
import { env } from "../config/env";

/**
 * Base application error class
 * All custom errors should extend this
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400)
 * Used for input validation failures
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, "VALIDATION_ERROR", details);
  }
}

/**
 * Not found error (404)
 * Used when a resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(404, `${resource} not found`, "NOT_FOUND");
  }
}

/**
 * Unauthorized error (401)
 * Used when authentication is required
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required") {
    super(401, message, "UNAUTHORIZED");
  }
}

/**
 * Forbidden error (403)
 * Used when user doesn't have permission
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(403, message, "FORBIDDEN");
  }
}

/**
 * Conflict error (409)
 * Used when resource already exists
 */
export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(409, message, "CONFLICT");
  }
}

/**
 * Global error handler middleware
 * Handles all errors and returns consistent JSON responses
 */
export function errorHandler(
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation error",
      code: "VALIDATION_ERROR",
      details: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  // Custom application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details && { details: err.details }),
    });
    return;
  }

  // Unexpected errors
  logger.error("Unexpected error:", err);
  
  const isDevelopment = env.NODE_ENV === "development";
  
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    ...(isDevelopment && {
      stack: err.stack,
      message: err.message,
    }),
  });
}

/**
 * Async handler wrapper
 * Automatically catches async errors and passes them to error handler
 * 
 * Usage:
 *   app.post("/api/endpoint", asyncHandler(async (req, res) => {
 *     // No need for try/catch - errors are automatically caught
 *   }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

