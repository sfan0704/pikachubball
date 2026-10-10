import type { ErrorCode } from "@shared/api/errors";

/** Every code a screen may see: the server's, plus two that only the browser can produce. */
export type ApiErrorCode = ErrorCode | "NETWORK_ERROR" | "INVALID_RESPONSE";

/** A failed API call, with the code the screens switch on and the request id to quote to support. */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number | null,
    readonly requestId: string | null = null,
    /** Seconds to wait before retrying, from Retry-After or the error details. */
    readonly retryAfterSeconds: number | null = null
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Whether an error is an ApiError with one of the given codes. */
export function isApiError(error: unknown, ...codes: ApiErrorCode[]): error is ApiError {
  return error instanceof ApiError && (codes.length === 0 || codes.includes(error.code));
}
