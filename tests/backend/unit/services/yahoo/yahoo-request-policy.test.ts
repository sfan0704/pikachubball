import { describe, expect, it, vi } from "vitest";
import {
  parseRetryAfter,
  withYahooRetries,
  YAHOO_CALL_TIMEOUT_MS,
  YAHOO_MAX_ATTEMPTS,
  YAHOO_TOTAL_BUDGET_MS,
  YahooRateLimitedError,
  YahooUnavailableError,
  type YahooRequestClock,
} from "../../../../../server/services/yahoo/yahoo-request-policy";

function fakeClock(start = 1_800_000_000_000) {
  let now = start;
  const sleeps: number[] = [];
  const clock: YahooRequestClock = {
    now: () => now,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
      now += milliseconds;
    },
  };
  return { clock, sleeps, advance: (milliseconds: number) => (now += milliseconds) };
}

const status = (code: number, headers: Record<string, string> = {}) => ({
  isAxiosError: true,
  response: { status: code, headers },
});
const timeout = { isAxiosError: true, code: "ECONNABORTED" };

describe("withYahooRetries", () => {
  it("returns the first success without waiting", async () => {
    const { clock, sleeps } = fakeClock();
    const call = vi.fn().mockResolvedValue("ok");

    await expect(withYahooRetries(call, clock)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith(YAHOO_CALL_TIMEOUT_MS);
    expect(sleeps).toEqual([]);
  });

  it("retries 5xx with backoff and stops after the attempt limit", async () => {
    const { clock, sleeps } = fakeClock();
    const call = vi.fn().mockRejectedValue(status(502));

    await expect(withYahooRetries(call, clock)).rejects.toBeInstanceOf(
      YahooUnavailableError,
    );
    expect(call).toHaveBeenCalledTimes(YAHOO_MAX_ATTEMPTS);
    expect(sleeps).toEqual([250, 500]);
  });

  it("retries timeouts and recovers when Yahoo answers", async () => {
    const { clock } = fakeClock();
    const call = vi.fn().mockRejectedValueOnce(timeout).mockResolvedValueOnce("ok");

    await expect(withYahooRetries(call, clock)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("waits for Retry-After on 429 when it fits the budget", async () => {
    const { clock, sleeps } = fakeClock();
    const call = vi
      .fn()
      .mockRejectedValueOnce(status(429, { "retry-after": "2" }))
      .mockResolvedValueOnce("ok");

    await expect(withYahooRetries(call, clock)).resolves.toBe("ok");
    expect(sleeps).toEqual([2_000]);
  });

  it("fails fast on 429 when Retry-After exceeds the budget or is missing", async () => {
    const { clock, sleeps } = fakeClock();
    const tooLong = vi.fn().mockRejectedValue(status(429, { "retry-after": "30" }));
    const missing = vi.fn().mockRejectedValue(status(429));

    const longError = await withYahooRetries(tooLong, clock).catch((error) => error);
    const missingError = await withYahooRetries(missing, clock).catch((error) => error);

    expect(longError).toBeInstanceOf(YahooRateLimitedError);
    expect(longError.statusCode).toBe(429);
    expect(longError.details).toEqual({ retryAfterSeconds: 30 });
    expect(missingError).toBeInstanceOf(YahooRateLimitedError);
    expect(tooLong).toHaveBeenCalledTimes(1);
    expect(missing).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it("passes 401, 403 and other 4xx through without retrying", async () => {
    const { clock } = fakeClock();
    for (const code of [401, 403, 404]) {
      const failure = status(code);
      const call = vi.fn().mockRejectedValue(failure);

      await expect(withYahooRetries(call, clock)).rejects.toBe(failure);
      expect(call).toHaveBeenCalledTimes(1);
    }
  });

  it("never exceeds the total budget, shrinking the last call's timeout", async () => {
    const { clock, advance } = fakeClock();
    const timeouts: number[] = [];
    const call = vi.fn(async (timeoutMs: number) => {
      timeouts.push(timeoutMs);
      advance(timeoutMs);
      throw timeout;
    });

    await expect(withYahooRetries(call, clock)).rejects.toBeInstanceOf(
      YahooUnavailableError,
    );
    expect(timeouts.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(
      YAHOO_TOTAL_BUDGET_MS,
    );
    expect(timeouts[0]).toBe(YAHOO_CALL_TIMEOUT_MS);
    expect(call.mock.calls.length).toBeLessThanOrEqual(YAHOO_MAX_ATTEMPTS);
  });

  it("does not start a call once a shared deadline has passed", async () => {
    const { clock } = fakeClock();
    const call = vi.fn();

    await expect(withYahooRetries(call, clock, clock.now() - 1)).rejects.toBeInstanceOf(
      YahooUnavailableError,
    );
    expect(call).not.toHaveBeenCalled();
  });
});

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-09-23T12:00:00Z");

  it("reads delta-seconds and HTTP dates", () => {
    expect(parseRetryAfter("5", now)).toBe(5);
    expect(parseRetryAfter("Wed, 23 Sep 2026 12:00:07 GMT", now)).toBe(7);
    expect(parseRetryAfter("Wed, 23 Sep 2026 11:00:00 GMT", now)).toBe(0);
  });

  it("ignores absent or malformed values", () => {
    expect(parseRetryAfter(undefined, now)).toBeUndefined();
    expect(parseRetryAfter("", now)).toBeUndefined();
    expect(parseRetryAfter("soon", now)).toBeUndefined();
  });
});
