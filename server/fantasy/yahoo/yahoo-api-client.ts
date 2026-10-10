/**
 * Direct Yahoo Fantasy API Client
 * Endpoint methods over the token manager and transport.
 */

import type { YahooAppConfig } from "../../config/config";
import type { YahooTokenStorage } from "../../storage/yahoo-token-storage";
import { systemClock, type YahooRequestClock } from "./yahoo-request-policy";
import { YahooTokenManager, type TokenRefresher } from "./yahoo-token-manager";
import { YahooTransport } from "./yahoo-transport";
import type { FetchFunction } from "./provider-http";

export class YahooApiClient {
  private constructor(private readonly transport: YahooTransport) {}

  /**
   * Create a YahooApiClient for a user from the Yahoo app's credentials,
   * which the composition root provides.
   */
  static async create(
    userId: string,
    tokenStorage: YahooTokenStorage,
    app: YahooAppConfig,
    clock: YahooRequestClock = systemClock,
    onRequest: () => void = () => {},
    network: { fetchFunction?: FetchFunction; refresher?: TokenRefresher } = {}
  ): Promise<YahooApiClient> {
    const tokens = await YahooTokenManager.load(
      userId,
      tokenStorage,
      app,
      clock,
      network.refresher
    );
    return new YahooApiClient(
      new YahooTransport(tokens, clock, onRequest, app.apiBaseUrl, network.fetchFunction)
    );
  }

  /** An authenticated GET of any Yahoo Fantasy path, with Yahoo's text decoded. */
  get(endpoint: string): Promise<unknown> {
    return this.transport.get(endpoint);
  }

  private apiRequest<T = unknown>(
    endpoint: string,
    params?: Record<string, string | number>
  ): Promise<T> {
    return this.transport.get<T>(endpoint, params);
  }

  /**
   * Team resource methods
   */
  async getTeamRoster(teamKey: string, week?: number): Promise<unknown> {
    const endpoint = week ? `/team/${teamKey}/roster;week=${week}` : `/team/${teamKey}/roster`;
    return this.apiRequest(endpoint);
  }
}
