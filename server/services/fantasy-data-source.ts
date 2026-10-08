import type { YahooClientProvider } from "../request-context";
import type {
  YahooApiLeagueResponse,
  YahooApiScoreboardResponse,
  YahooApiTeamResponse,
} from "../types/yahoo-api.js";

export interface FantasyDataSource {
  getLeagueStandings(leagueKey: string): Promise<YahooApiLeagueResponse>;
  getLeagueSettings(leagueKey: string): Promise<YahooApiLeagueResponse>;
  getLeagueScoreboard(leagueKey: string, week?: number): Promise<YahooApiScoreboardResponse>;
  getTeamRoster(teamKey: string): Promise<YahooApiTeamResponse>;
}

export class YahooFantasyDataSource implements FantasyDataSource {
  constructor(private yahooClient: YahooClientProvider) {}

  private getClient() {
    return this.yahooClient();
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
}
