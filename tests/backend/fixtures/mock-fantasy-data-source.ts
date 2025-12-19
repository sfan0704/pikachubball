import type { FantasyDataSource } from '../../../server/services/fantasy-data-source.js';
import { mockLeagueSettings, mockStandings, mockScoreboard } from './yahoo-responses';

/**
 * Mock implementation of FantasyDataSource for testing
 * Returns fixture data instead of making real API calls
 */
export class MockFantasyDataSource implements FantasyDataSource {
  async getLeagueStandings(leagueKey: string): Promise<any> {
    return mockStandings;
  }

  async getLeagueSettings(leagueKey: string): Promise<any> {
    return mockLeagueSettings;
  }

  async getLeagueScoreboard(leagueKey: string, week?: number): Promise<any> {
    return mockScoreboard;
  }

  async getTeamRoster(teamKey: string): Promise<any> {
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
}

/**
 * Create a mock data source for testing
 */
export function createMockFantasyDataSource(): MockFantasyDataSource {
  return new MockFantasyDataSource();
}

/**
 * Create a mock with malformed data for error testing
 */
export function createMalformedFantasyDataSource(): FantasyDataSource {
  return {
    getLeagueStandings: async () => ({ fantasy_content: null }),
    getLeagueSettings: async () => ({ fantasy_content: { league: [] } }),
    getLeagueScoreboard: async () => ({ fantasy_content: { league: [] } }),
    getTeamRoster: async () => ({ fantasy_content: null }),
    getPlayerStats: async () => ({ fantasy_content: null }),
  };
}

