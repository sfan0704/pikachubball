/**
 * Raw Yahoo Fantasy API Response Types
 * These types match the exact structure returned by Yahoo's API (snake_case)
 */

/**
 * Yahoo API uses a nested array structure:
 * - [0] = properties (array of objects)
 * - [1] = subresources (object with nested data)
 */

// ============================================================================
// Common Structures
// ============================================================================

export interface YahooApiStat {
  stat_id: string;
  value: string | number;
}

export interface YahooApiStatWrapper {
  stat: YahooApiStat;
}

export interface YahooApiManager {
  manager: {
    guid: string;
    nickname?: string;
    email?: string;
  };
}

// ============================================================================
// League Response Types
// ============================================================================

export interface YahooApiLeagueProperties {
  league_key: string;
  name: string;
  season: string;
  current_week: string;
  end_week: string;
  scoring_type?: string;
  num_teams?: string;
  [key: string]: any; // Yahoo API may include other fields
}

export interface YahooApiStandings {
  standings: Array<{
    teams: {
      count: number;
      [teamIndex: string]: {
        team: YahooApiTeamData;
      } | number; // count property is a number
    };
  }>;
}

export interface YahooApiSettings {
  settings?: any; // Settings structure varies
}

export interface YahooApiScoreboard {
  scoreboard?: {
    matchups?: Array<{
      matchup?: YahooApiMatchupData;
    }> | {
      count?: number;
      [index: string]: {
        matchup?: YahooApiMatchupData;
      } | number | undefined;
    };
  };
}

export interface YahooApiLeagueSubresources {
  standings?: YahooApiStandings;
  settings?: YahooApiSettings;
  scoreboard?: YahooApiScoreboard;
}

export interface YahooApiLeagueResponse {
  fantasy_content: {
    league: [
      YahooApiLeagueProperties[] | YahooApiLeagueProperties, // [0] = properties array OR object (settings/standings use object)
      YahooApiLeagueSubresources  // [1] = subresources
    ];
  };
}

// ============================================================================
// Team Response Types
// ============================================================================

export interface YahooApiTeamProperties {
  team_key: string;
  name: string;
  managers?: {
    managers: YahooApiManager[];
  };
  [key: string]: any; // Yahoo API may include other fields
}

export interface YahooApiTeamStats {
  stats: YahooApiStatWrapper[];
}

export interface YahooApiRoster {
  roster?: {
    players?: {
      count: number;
      [playerIndex: string]: {
        player: YahooApiPlayerData;
      } | number; // count property is a number
    };
  };
}

export interface YahooApiTeamSubresources {
  team_stats?: YahooApiTeamStats;
  roster?: YahooApiRoster;
}

export interface YahooApiTeamData {
  0: YahooApiTeamProperties[];  // Properties array
  1?: YahooApiTeamSubresources; // Subresources
}

export interface YahooApiTeamResponse {
  fantasy_content: {
    team: YahooApiTeamData;
  };
}

// ============================================================================
// Player Response Types
// ============================================================================

export interface YahooApiPlayerProperties {
  player_key: string;
  name?: {
    full?: string;
    first?: string;
    last?: string;
  } | string;
  display_position?: string;
  eligible_positions?: Array<{
    position: string;
  }>;
  status?: string;
  editorial_team_abbr?: string;
  editorial_team_full_name?: string;
  [key: string]: any;
}

export interface YahooApiPlayerAdvancedStats {
  coverage_type: string;
  season?: string;
  week?: string;
  stats: YahooApiStatWrapper[];
}

export interface YahooApiPlayerSubresources {
  player_stats?: {
    coverage_type: string;
    season?: string;
    week?: string;
    stats: YahooApiStatWrapper[];
  };
  player_advanced_stats?: YahooApiPlayerAdvancedStats;
}

export interface YahooApiPlayerData {
  0: YahooApiPlayerProperties[]; // Properties array
  1?: YahooApiPlayerSubresources; // Subresources (stats, etc.)
}

export interface YahooApiPlayerResponse {
  fantasy_content: {
    player: YahooApiPlayerData;
  };
}

// ============================================================================
// Matchup/Scoreboard Response Types
// ============================================================================

export interface YahooApiTeamRemainingGames {
  coverage_type: string;
  week?: string;
  date?: string;
  total: {
    remaining_games: number;
    live_games: number;
    completed_games: number;
  };
}

export interface YahooApiMatchupTeam {
  team: YahooApiTeamData;
  team_points?: {
    total?: string;
  };
  team_stats?: YahooApiTeamStats;
  team_remaining_games?: YahooApiTeamRemainingGames;
}

export interface YahooApiMatchupProperties {
  week?: string;
  status?: string;
  [key: string]: any;
}

export interface YahooApiMatchupData {
  0?: YahooApiMatchupProperties[] | {
    teams?: {
      count?: number;
      [teamIndex: string]: YahooApiMatchupTeam | number | undefined;
    };
  };
  1?: {
    teams?: {
      count?: number;
      [teamIndex: string]: YahooApiMatchupTeam | number | undefined;
    };
  };
}

export interface YahooApiScoreboardResponse {
  fantasy_content: {
    league: [
      YahooApiLeagueProperties[],
      {
        scoreboard?: {
          matchups?: Array<{
            matchup?: YahooApiMatchupData;
          }>;
        };
      }
    ];
  };
}

// ============================================================================
// Games/Leagues Response Types
// ============================================================================

export interface YahooApiGame {
  game_key: string;
  name: string;
  code: string;
  season: string;
  [key: string]: any;
}

export interface YahooApiLeagueInfo {
  league_key: string;
  name: string;
  [key: string]: any;
}

export interface YahooApiUserGamesResponse {
  fantasy_content: {
    users: Array<{
      user: [
        { guid: string },
        {
          games?: {
            game?: YahooApiGame[] | YahooApiGame;
            count?: number;
          };
        }
      ];
    }>;
  };
}

export interface YahooApiUserLeaguesResponse {
  fantasy_content: {
    users: Array<{
      user: [
        { guid: string },
        {
          games?: {
            game?: Array<{
              0: YahooApiGame[];
              1?: {
                leagues?: {
                  league?: YahooApiLeagueInfo[] | YahooApiLeagueInfo;
                };
              };
            }>;
          };
        }
      ];
    }>;
  };
}

