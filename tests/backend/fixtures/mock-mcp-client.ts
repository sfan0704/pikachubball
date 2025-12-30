import type { YahooFantasyMCPClient } from '../../../server/mcp-client';
import { mockLeagueSettings, mockStandings, mockScoreboard } from './yahoo-responses';

/**
 * Mock implementation of Yahoo MCP Client for testing
 * Returns fixture data instead of making real API calls
 */
export class MockMCPClient implements Partial<YahooFantasyMCPClient> {
  private credentials: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  } | null = null;

  async setCredentials(
    accessToken: string,
    refreshToken: string,
    expiresAt: number
  ): Promise<void> {
    this.credentials = { accessToken, refreshToken, expiresAt };
  }

  async getLeagueSettings(_leagueKey: string): Promise<any> {
    if (!this.credentials) {
      throw new Error('Credentials not set');
    }
    return mockLeagueSettings;
  }

  async getLeagueStandings(_leagueKey: string): Promise<any> {
    if (!this.credentials) {
      throw new Error('Credentials not set');
    }
    return mockStandings;
  }

  async getLeagueScoreboard(_leagueKey: string, _week?: number): Promise<any> {
    if (!this.credentials) {
      throw new Error('Credentials not set');
    }
    return mockScoreboard;
  }

  async getUserLeagues(): Promise<any> {
    if (!this.credentials) {
      throw new Error('Credentials not set');
    }
    return {
      fantasy_content: {
        users: {
          "0": {
            user: [
              { guid: "test-user-guid" },
              {
                games: {
                  "0": {
                    game: [
                      { game_key: "466" },
                      {
                        leagues: {
                          "0": {
                            league: [
                              {
                                league_key: "466.l.12345",
                                name: "Test Fantasy League",
                                season: "2024",
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    };
  }

  async getTeamRoster(teamKey: string): Promise<any> {
    if (!this.credentials) {
      throw new Error('Credentials not set');
    }
    return {
      fantasy_content: {
        team: [
          [
            { team_key: teamKey },
            { name: "Test Team" },
          ],
          {
            roster: [
              {
                players: {
                  count: 2,
                  "0": {
                    player: [
                      [
                        { player_key: "466.p.123" },
                        { name: { full: "LeBron James" } },
                        { display_position: "SF" },
                        { editorial_team_abbr: "LAL" },
                        { status: "" },
                      ],
                    ],
                  },
                  "1": {
                    player: [
                      [
                        { player_key: "466.p.456" },
                        { name: { full: "Stephen Curry" } },
                        { display_position: "PG" },
                        { editorial_team_abbr: "GSW" },
                        { status: "" },
                      ],
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    };
  }

  async getPlayerStats(playerKeys: string[]): Promise<any> {
    if (!this.credentials) {
      throw new Error('Credentials not set');
    }
    return {
      fantasy_content: {
        players: playerKeys.map((key, index) => ({
          player: [
            [
              { player_key: key },
              { name: { full: `Player ${index + 1}` } },
            ],
            {
              player_stats: {
                stats: [
                  { stat: { stat_id: "5", value: "0.475" } },
                  { stat: { stat_id: "12", value: "25" } },
                ],
              },
            },
          ],
        })),
      },
    };
  }

  async callTool(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'get_user_leagues':
        return this.getUserLeagues();
      case 'get_league_standings':
        return this.getLeagueStandings(args.leagueKey);
      case 'get_league_scoreboard':
        return this.getLeagueScoreboard(args.leagueKey, args.week);
      case 'get_team_roster':
        return this.getTeamRoster(args.teamKey);
      case 'get_player_stats':
        return this.getPlayerStats(args.playerKeys);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

/**
 * Create mock with malformed data for error testing
 */
export function createMalformedMCPClient(): MockMCPClient {
  const client = new MockMCPClient();
  // Override methods to return malformed data
  (client as any).getLeagueStandings = async () => ({ fantasy_content: null });
  (client as any).getLeagueSettings = async () => ({ fantasy_content: { league: [] } });
  return client;
}

export function createMockMCPClient(): MockMCPClient {
  return new MockMCPClient();
}
