/**
 * Bounded request policy for Yahoo calls: per-call timeout, total budget,
 * finite retries, and distinct errors for each provider failure class.
 */

import { AppError } from "../../middleware/error-handler";

export const YAHOO_CALL_TIMEOUT_MS = 8_000;
export const YAHOO_TOTAL_BUDGET_MS = 20_000;
export const YAHOO_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;

/** The stored Yahoo grant is unusable; the user must connect Yahoo again. */
export class YahooReconnectRequiredError extends AppError {
  constructor() {
    super(
      401,
      "Yahoo Fantasy credentials expired or were revoked. Please reconnect your Yahoo account.",
      "YAHOO_RECONNECT_REQUIRED",
    );
    this.name = "YahooReconnectRequiredError";
  }
}

/** Yahoo asked us to slow down and its Retry-After did not fit the budget. */
export class YahooRateLimitedError extends AppError {
  constructor(public readonly retryAfterSeconds: number | undefined) {
    super(
      429,
      "Yahoo is rate limiting requests. Please try again shortly.",
      "YAHOO_RATE_LIMITED",
      retryAfterSeconds === undefined ? undefined : { retryAfterSeconds },
    );
    this.name = "YahooRateLimitedError";
  }
}

/** Yahoo timed out, was unreachable, or kept failing within the budget. */
export class YahooUnavailableError extends AppError {
  constructor() {
    super(
      503,
      "Yahoo Fantasy is not responding right now. Please try again shortly.",
      "YAHOO_UNAVAILABLE",
    );
    this.name = "YahooUnavailableError";
  }
}

export interface YahooRequestClock {
  now(): number;
  sleep(milliseconds: number): Promise<void>;
}

export const systemClock: YahooRequestClock = {
  now: () => Date.now(),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

/** Parses Retry-After as delta-seconds or an HTTP date; undefined when absent or invalid. */
export function parseRetryAfter(value: unknown, now: number): number | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  if (/^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - now) / 1000));
}

interface ProviderFailure {
  code?: string;
  isAxiosError?: boolean;
  response?: { status?: number; headers?: Record<string, unknown> };
}

const NETWORK_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

function asFailure(error: unknown): ProviderFailure {
  return typeof error === "object" && error !== null ? (error as ProviderFailure) : {};
}

/** HTTP status of a failed provider call, if Yahoo responded at all. */
export function providerStatus(error: unknown): number | undefined {
  return asFailure(error).response?.status;
}

function isTransient(error: unknown): boolean {
  const failure = asFailure(error);
  if (!failure.response) {
    // Timeout or network failure before Yahoo answered.
    return failure.isAxiosError === true || NETWORK_ERROR_CODES.has(failure.code ?? "");
  }
  return (failure.response.status ?? 0) >= 500;
}

/**
 * Runs `call` with finite retries before `deadline` (by default the total
 * budget from now; callers making several calls share one deadline). 5xx,
 * timeouts and network errors retry with backoff; 429 waits for Retry-After
 * when it fits. Every other outcome (success, 401, 403, other 4xx) returns or
 * throws as is.
 */
export async function withYahooRetries<T>(
  call: (timeoutMs: number) => Promise<T>,
  clock: YahooRequestClock = systemClock,
  deadline: number = clock.now() + YAHOO_TOTAL_BUDGET_MS,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const remaining = deadline - clock.now();
    if (remaining <= 0) {
      throw new YahooUnavailableError();
    }

    try {
      return await call(Math.min(YAHOO_CALL_TIMEOUT_MS, remaining));
    } catch (error) {
      const lastAttempt = attempt >= YAHOO_MAX_ATTEMPTS;

      if (providerStatus(error) === 429) {
        const retryAfter = parseRetryAfter(
          asFailure(error).response?.headers?.["retry-after"],
          clock.now(),
        );
        const waitMs = (retryAfter ?? 0) * 1000;
        if (lastAttempt || retryAfter === undefined || clock.now() + waitMs >= deadline) {
          throw new YahooRateLimitedError(retryAfter);
        }
        await clock.sleep(waitMs);
        continue;
      }

      if (isTransient(error)) {
        const waitMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        if (lastAttempt || clock.now() + waitMs >= deadline) {
          throw new YahooUnavailableError();
        }
        await clock.sleep(waitMs);
        continue;
      }

      throw error;
    }
  }
}
