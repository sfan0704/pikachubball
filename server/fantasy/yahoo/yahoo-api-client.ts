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
import { readAllUserLeagues, readUserGameLeagues } from "../legacy/user-leagues";

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
    return new YahooApiClient(new YahooTransport(tokens, clock, onRequest, network.fetchFunction));
  }

  /** An authenticated GET of any Yahoo Fantasy path, with Yahoo's text decoded. */
  get(endpoint: string): Promise<unknown> {
    return this.transport.get(endpoint);
  }

  private apiRequest<T = any>(
    endpoint: string,
    params?: Record<string, string | number>
  ): Promise<T> {
    return this.transport.get<T>(endpoint, params);
  }

  /** The user's leagues across all games (legacy discovery). */
  getAllUserLeagues(): Promise<any> {
    return readAllUserLeagues((endpoint) => this.apiRequest(endpoint));
  }

  /** The user's leagues in one game, such as "nba" (legacy discovery). */
  getUserGameLeagues(gameCode: string): Promise<any> {
    return readUserGameLeagues((endpoint) => this.apiRequest(endpoint), gameCode);
  }

  /**
   * League resource methods
   */
  async getLeagueStandings(leagueKey: string): Promise<any> {
    return this.apiRequest(`/league/${leagueKey}/standings`);
  }

  /**
   * Team resource methods
   */
  async getTeamRoster(teamKey: string, week?: number): Promise<any> {
    const endpoint = week ? `/team/${teamKey}/roster;week=${week}` : `/team/${teamKey}/roster`;
    return this.apiRequest(endpoint);
  }
}
