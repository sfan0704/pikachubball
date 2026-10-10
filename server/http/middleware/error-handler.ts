import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, type ErrorBody, type ErrorCode } from "../../../shared/api/errors";
import type { Logger } from "../../utils/logger";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  YAHOO_RECONNECT_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
  YAHOO_RATE_LIMITED: 429,
  YAHOO_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/** The HTTP status for an error code; the only place codes map to HTTP. */
export function statusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}

function sendError(
  req: Request,
  res: Response,
  code: ErrorCode,
  message: string,
  details?: unknown
): void {
  const body: ErrorBody = {
    code,
    message,
    requestId: req.scope?.requestId ?? "unknown",
    ...(details === undefined ? {} : { details }),
  };
  res.status(statusForCode(code)).json(body);
}

/** What the error handler needs from the composition root. */
export interface ErrorHandlerOptions {
  readonly logger: Logger;
  /** Include the message and stack of unexpected errors in the response (development only). */
  readonly exposeErrorDetails: boolean;
}

/**
 * Builds the global error handler. Every error becomes one response body,
 * `{ code, message, requestId }`, with the status mapped from its code.
 */
export function createErrorHandler({ logger, exposeErrorDetails }: ErrorHandlerOptions) {
  return function errorHandler(
    err: Error | AppError | ZodError,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    if (err instanceof ZodError) {
      sendError(
        req,
        res,
        "VALIDATION_ERROR",
        "Validation error",
        err.errors.map((e) => ({ path: e.path.join("."), message: e.message }))
      );
      return;
    }

    if (err instanceof AppError) {
      const retryAfter = (err.details as { retryAfterSeconds?: unknown } | undefined)
        ?.retryAfterSeconds;
      if (typeof retryAfter === "number") {
        res.setHeader("Retry-After", String(retryAfter));
      }
      sendError(req, res, err.code, err.message, err.details);
      return;
    }

    logger.error("Unexpected error:", err);
    sendError(
      req,
      res,
      "INTERNAL_ERROR",
      "Internal server error",
      exposeErrorDetails ? { message: err.message, stack: err.stack } : undefined
    );
  };
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
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
