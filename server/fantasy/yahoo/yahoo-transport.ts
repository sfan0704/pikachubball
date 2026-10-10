import { logger } from "../../utils/logger";
import { requestJson, type FetchFunction } from "./provider-http";
import type { YahooTokenManager } from "./yahoo-token-manager";
import {
  providerStatus,
  withYahooRetries,
  YAHOO_TOTAL_BUDGET_MS,
  YahooReconnectRequiredError,
  type YahooRequestClock,
} from "./yahoo-request-policy";
import { decodeYahooStrings } from "./yahoo-text";

/**
 * Authenticated GET requests to the Yahoo Fantasy API under the request
 * policy (per-attempt timeout, total budget, bounded retries). A 401 refreshes
 * the token once and repeats the request.
 */
export class YahooTransport {
  constructor(
    private readonly tokens: YahooTokenManager,
    private readonly clock: YahooRequestClock,
    private readonly onRequest: () => void,
    private readonly baseUrl: string,
    private readonly fetchFunction: FetchFunction = fetch
  ) {}

  /** The response with the HTML entities Yahoo puts in text fields decoded. */
  async get<T = unknown>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
    return decodeYahooStrings(await this.getRaw(endpoint, params)) as T;
  }

  /** The response exactly as Yahoo sent it. */
  async getRaw(endpoint: string, params?: Record<string, string | number>): Promise<unknown> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      query.append(key, String(value));
    }
    query.append("format", "json");
    const url = `${this.baseUrl}${endpoint}?${query.toString()}`;
    const deadline = this.clock.now() + YAHOO_TOTAL_BUDGET_MS;

    try {
      return await this.attempt(url, deadline);
    } catch (error) {
      if (providerStatus(error) !== 401) {
        this.logFailure(endpoint, error);
        throw error;
      }
    }

    logger.debug("Got 401, attempting token refresh", { endpoint });
    await this.tokens.refresh();
    try {
      return await this.attempt(url, deadline);
    } catch (error) {
      if (providerStatus(error) === 401) {
        throw new YahooReconnectRequiredError();
      }
      this.logFailure(endpoint, error);
      throw error;
    }
  }

  private attempt(url: string, deadline: number): Promise<unknown> {
    return withYahooRetries(
      (timeoutMs) => {
        this.onRequest();
        return requestJson(
          url,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${this.tokens.accessToken}`,
            },
          },
          timeoutMs,
          this.fetchFunction
        );
      },
      this.clock,
      deadline
    );
  }

  private logFailure(endpoint: string, error: unknown): void {
    logger.error("Yahoo API request failed:", {
      endpoint,
      status: providerStatus(error),
      code: error instanceof Error ? ((error as { code?: string }).code ?? error.name) : undefined,
    });
  }
}
