import { isApiError } from "./errors";

/**
 * Counts each query's rate-limited polls in a row, keyed by query hash, so its
 * poll interval can back off until a poll succeeds.
 */
export class RateLimitBackoff {
  private readonly streaks = new Map<string, number>();

  /** Rate-limited polls in a row for a query; 0 after a success or before any poll. */
  streak(queryHash: string): number {
    return this.streaks.get(queryHash) ?? 0;
  }

  /**
   * Runs a fetch and records its outcome before the query sees it, so the next
   * interval is computed from the updated count. Other errors, including
   * YAHOO_UNAVAILABLE, leave the count as it was.
   */
  async track<T>(queryHash: string, fetch: Promise<T>): Promise<T> {
    try {
      const data = await fetch;
      this.streaks.delete(queryHash);
      return data;
    } catch (error) {
      if (isApiError(error, "YAHOO_RATE_LIMITED")) {
        this.streaks.set(queryHash, this.streak(queryHash) + 1);
      }
      throw error;
    }
  }
}
