import type { YahooClientFactory } from "./yahoo/yahoo-api-client.js";
import type {
  YahooApiLeagueResponse,
  YahooApiScoreboardResponse,
  YahooApiTeamResponse,
  YahooApiPlayerResponse,
} from "../types/yahoo-api.js";
import type { YahooTokenStorage } from "../storage/yahoo-token-storage.js";

export interface FantasyDataSource {
  getLeagueStandings(leagueKey: string): Promise<YahooApiLeagueResponse>;
  getLeagueSettings(leagueKey: string): Promise<YahooApiLeagueResponse>;
  getLeagueScoreboard(leagueKey: string, week?: number): Promise<YahooApiScoreboardResponse>;
  getTeamRoster(teamKey: string): Promise<YahooApiTeamResponse>;
  getPlayerStats(playerKeys: string[]): Promise<YahooApiPlayerResponse | null>;
}

export class YahooFantasyDataSource implements FantasyDataSource {
  constructor(
    private userId: string,
    private tokenStorage: YahooTokenStorage,
    private createClient: YahooClientFactory
  ) {}

  private getClient() {
    return this.createClient(this.userId, this.tokenStorage);
  }

  async getLeagueStandings(leagueKey: string): Promise<YahooApiLeagueResponse> {
    const client = await this.getClient();
    return await client.getLeagueStandings(leagueKey);
  }

  async getLeagueSettings(leagueKey: string): Promise<YahooApiLeagueResponse> {
    const client = await this.getClient();
    return await client.getLeagueSettings(leagueKey);
  }

  async getLeagueScoreboard(leagueKey: string, week?: number): Promise<YahooApiScoreboardResponse> {
    const client = await this.getClient();
    return await client.getLeagueScoreboard(leagueKey, week);
  }

  async getTeamRoster(teamKey: string): Promise<YahooApiTeamResponse> {
    const client = await this.getClient();
    return await client.getTeamRoster(teamKey);
  }

  async getPlayerStats(playerKeys: string[]): Promise<YahooApiPlayerResponse | null> {
    const client = await this.getClient();
    // For now, return the first player's stats as a placeholder
    if (playerKeys.length === 0) {
      return null;
    }
    // Note: This is a simplified implementation
    // You may want to enhance this based on your needs
    return await client.getPlayerStats(playerKeys[0]);
  }
}
