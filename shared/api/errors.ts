import { z } from "zod";

/** Every error code the API returns. HTTP status is mapped in one place on the server. */
export const ERROR_CODES = [
  "UNAUTHORIZED",
  "YAHOO_RECONNECT_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "YAHOO_RATE_LIMITED",
  "YAHOO_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** The body of every error response. */
export const errorBodySchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  requestId: z.string(),
  details: z.unknown().optional(),
});

export type ErrorBody = z.infer<typeof errorBodySchema>;

/** A typed error with a code; it carries no HTTP status. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Input that fails validation. */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
  }
}

/** A resource that doesn't exist. */
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super("NOT_FOUND", `${resource} not found`);
    this.name = "NotFoundError";
  }
}

/** A request without a valid session. */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

/** A request for something the user may not access. */
export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super("FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

/** A write that conflicts with the current state. */
export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super("CONFLICT", message);
    this.name = "ConflictError";
  }
}
