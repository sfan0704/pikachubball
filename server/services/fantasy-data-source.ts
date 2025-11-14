import { YahooFantasyMCPClient } from '../mcp-client.js';

export interface FantasyDataSource {
  getLeagueStandings(leagueKey: string): Promise<any>;
  getLeagueSettings(leagueKey: string): Promise<any>;
  getLeagueScoreboard(leagueKey: string, week?: number): Promise<any>;
  getTeamRoster(teamKey: string): Promise<any>;
  getPlayerStats(playerKeys: string[]): Promise<any>;
}

export class YahooMCPDataSource implements FantasyDataSource {
  constructor(private mcpClient: YahooFantasyMCPClient) {}

  async getLeagueStandings(leagueKey: string): Promise<any> {
    return this.mcpClient.getLeagueStandings(leagueKey);
  }

  async getLeagueSettings(leagueKey: string): Promise<any> {
    return this.mcpClient.getLeagueSettings(leagueKey);
  }

  async getLeagueScoreboard(leagueKey: string, week?: number): Promise<any> {
    return this.mcpClient.getLeagueScoreboard(leagueKey, week);
  }

  async getTeamRoster(teamKey: string): Promise<any> {
    return this.mcpClient.getTeamRoster(teamKey);
  }

  async getPlayerStats(playerKeys: string[]): Promise<any> {
    return this.mcpClient.getPlayerStats(playerKeys);
  }
}
