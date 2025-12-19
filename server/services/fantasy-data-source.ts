import { getYahooApiClient } from './yahoo/yahoo-api-client.js';
import type {
  YahooApiLeagueResponse,
  YahooApiScoreboardResponse,
  YahooApiTeamResponse,
  YahooApiPlayerResponse,
} from '../types/yahoo-api.js';

export interface FantasyDataSource {
  getLeagueStandings(leagueKey: string): Promise<YahooApiLeagueResponse>;
  getLeagueSettings(leagueKey: string): Promise<YahooApiLeagueResponse>;
  getLeagueScoreboard(leagueKey: string, week?: number): Promise<YahooApiScoreboardResponse>;
  getTeamRoster(teamKey: string): Promise<YahooApiTeamResponse>;
  getPlayerStats(playerKeys: string[]): Promise<YahooApiPlayerResponse | null>;
}

export class YahooFantasyDataSource implements FantasyDataSource {
  constructor(private userId: string) {}

  async getLeagueStandings(leagueKey: string): Promise<YahooApiLeagueResponse> {
    const { logger } = await import("../utils/logger");
    const client = await getYahooApiClient(this.userId);
    
    const response = await client.getLeagueStandings(leagueKey);
    
    logger.debug("Yahoo API standings response:", {
      leagueKey,
      hasFantasyContent: !!response?.fantasy_content,
      leagueArrayLength: response?.fantasy_content?.league?.length,
      hasStandings: !!response?.fantasy_content?.league?.[1]?.standings,
      hasTeams: !!response?.fantasy_content?.league?.[1]?.standings?.[0]?.teams,
      teamsCount: response?.fantasy_content?.league?.[1]?.standings?.[0]?.teams?.count,
    });
    
    return response;
  }

  async getLeagueSettings(leagueKey: string): Promise<YahooApiLeagueResponse> {
    const client = await getYahooApiClient(this.userId);
    return await client.getLeagueSettings(leagueKey);
  }

  async getLeagueScoreboard(leagueKey: string, week?: number): Promise<YahooApiScoreboardResponse> {
    const client = await getYahooApiClient(this.userId);
    return await client.getLeagueScoreboard(leagueKey, week);
  }

  async getTeamRoster(teamKey: string): Promise<YahooApiTeamResponse> {
    const client = await getYahooApiClient(this.userId);
    return await client.getTeamRoster(teamKey);
  }

  async getPlayerStats(playerKeys: string[]): Promise<YahooApiPlayerResponse | null> {
    const client = await getYahooApiClient(this.userId);
    // For now, return the first player's stats as a placeholder
    if (playerKeys.length === 0) {
      return null;
    }
    // Note: This is a simplified implementation
    // You may want to enhance this based on your needs
    return await client.getPlayerStats(playerKeys[0]);
  }
}
