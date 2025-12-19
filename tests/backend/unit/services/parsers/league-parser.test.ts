import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseLeague, parseTeam, parseTeamsFromStandings } from '../../../../../server/services/parsers/league-parser';
import { logger } from '../../../../../server/utils/logger';

// Mock logger
vi.mock('../../../../../server/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('league-parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseLeague', () => {
    it('should parse valid league data with array structure', () => {
      // ARRANGE - Array structure (some endpoints)
      const leagueData = {
        fantasy_content: {
          league: [
            [
              {
                league_key: '466.l.12345',
                name: 'Test League',
                season: '2024',
                current_week: '5',
                end_week: '22',
                scoring_type: 'head',
                num_teams: '12',
              },
            ],
          ],
        },
      };

      // ACT
      const result = parseLeague(leagueData);

      // ASSERT
      expect(result).toEqual({
        leagueKey: '466.l.12345',
        name: 'Test League',
        season: 2024,
        currentWeek: 5,
        endWeek: 22,
        scoringType: 'head',
        numTeams: 12,
      });
    });

    it('should parse valid league data with object structure (settings/standings endpoints)', () => {
      // ARRANGE - Object structure (settings/standings endpoints)
      const leagueData = {
        fantasy_content: {
          league: [
            {
              league_key: '466.l.12345',
              name: 'Test League',
              season: '2024',
              current_week: '5',
              end_week: '22',
              scoring_type: 'head',
              num_teams: '12',
            },
            {
              settings: {},
            },
          ],
        },
      };

      // ACT
      const result = parseLeague(leagueData);

      // ASSERT
      expect(result).toEqual({
        leagueKey: '466.l.12345',
        name: 'Test League',
        season: 2024,
        currentWeek: 5,
        endWeek: 22,
        scoringType: 'head',
        numTeams: 12,
      });
    });

    it('should return null when data is null', () => {
      // ACT
      const result = parseLeague(null);

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid league data: missing fantasy_content.league');
    });

    it('should return null when data is undefined', () => {
      // ACT
      const result = parseLeague(undefined);

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid league data: missing fantasy_content.league');
    });

    it('should return null when fantasy_content is missing', () => {
      // ARRANGE
      const leagueData = {};

      // ACT
      const result = parseLeague(leagueData as any);

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid league data: missing fantasy_content.league');
    });

    it('should return null when league array is empty', () => {
      // ARRANGE
      const leagueData = {
        fantasy_content: {
          league: [],
        },
      };

      // ACT
      const result = parseLeague(leagueData);

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid league data: league array is empty or invalid');
    });

    it('should return null when league is not an array', () => {
      // ARRANGE
      const leagueData = {
        fantasy_content: {
          league: { not: 'an array' },
        },
      };

      // ACT
      const result = parseLeague(leagueData as any);

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid league data: league array is empty or invalid');
    });

    it('should return null when properties array is empty', () => {
      // ARRANGE
      const leagueData = {
        fantasy_content: {
          league: [[]],
        },
      };

      // ACT
      const result = parseLeague(leagueData);

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid league data: league_key not found in properties');
    });

    it('should return null when properties is not an array and missing league_key', () => {
      // ARRANGE - Object without league_key
      const leagueData = {
        fantasy_content: {
          league: [{ not: 'league_key' }],
        },
      };

      // ACT
      const result = parseLeague(leagueData as any);

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid league data: league_key not found in properties');
    });

    it('should return null when league_key is not found', () => {
      // ARRANGE
      const leagueData = {
        fantasy_content: {
          league: [
            [
              {
                name: 'Test League',
                // Missing league_key
              },
            ],
          ],
        },
      };

      // ACT
      const result = parseLeague(leagueData);

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid league data: league_key not found in properties');
    });

    it('should use default values for missing optional fields', () => {
      // ARRANGE
      const leagueData = {
        fantasy_content: {
          league: [
            [
              {
                league_key: '466.l.12345',
                // Missing other fields
              },
            ],
          ],
        },
      };

      // ACT
      const result = parseLeague(leagueData);

      // ASSERT
      expect(result).toEqual({
        leagueKey: '466.l.12345',
        name: 'Unknown League',
        season: 0,
        currentWeek: 1,
        endWeek: 22,
        scoringType: 'roto',
        numTeams: 0,
      });
    });

    it('should handle roto scoring type', () => {
      // ARRANGE
      const leagueData = {
        fantasy_content: {
          league: [
            [
              {
                league_key: '466.l.12345',
                scoring_type: 'roto',
              },
            ],
          ],
        },
      };

      // ACT
      const result = parseLeague(leagueData);

      // ASSERT
      expect(result?.scoringType).toBe('roto');
    });

    it('should handle invalid season values', () => {
      // ARRANGE
      const leagueData = {
        fantasy_content: {
          league: [
            [
              {
                league_key: '466.l.12345',
                season: 'invalid',
              },
            ],
          ],
        },
      };

      // ACT
      const result = parseLeague(leagueData);

      // ASSERT
      expect(result?.season).toBe(0);
    });

    it('should handle parsing errors gracefully', () => {
      // ARRANGE
      const leagueData = {
        fantasy_content: {
          league: [
            [
              {
                league_key: '466.l.12345',
                // This will cause an error when trying to access properties
              },
            ],
          ],
        },
      };

      // Mock parseInt to throw an error
      const originalParseInt = global.parseInt;
      global.parseInt = vi.fn(() => {
        throw new Error('Parse error');
      });

      // ACT
      const result = parseLeague(leagueData);

      // ASSERT
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();

      // Restore
      global.parseInt = originalParseInt;
    });
  });

  describe('parseTeam', () => {
    it('should parse valid team data', () => {
      // ARRANGE
      const teamData = [
        [
          {
            team_key: '466.l.12345.t.1',
            name: 'Test Team',
            managers: [
              {
                manager: {
                  nickname: 'John Doe',
                  guid: 'guid-123',
                },
              },
            ],
          },
        ],
      ];
      const leagueKey = '466.l.12345';

      // ACT
      const result = parseTeam(teamData, leagueKey);

      // ASSERT
      expect(result).toEqual({
        teamKey: '466.l.12345.t.1',
        teamName: 'Test Team',
        leagueKey: '466.l.12345',
        managerName: 'John Doe',
        managerGuid: 'guid-123',
      });
    });

    it('should parse valid team data without managers', () => {
      // ARRANGE
      const teamData = [
        [
          {
            team_key: '466.l.12345.t.1',
            name: 'Test Team',
          },
        ],
      ];
      const leagueKey = '466.l.12345';

      // ACT
      const result = parseTeam(teamData, leagueKey);

      // ASSERT
      expect(result).toEqual({
        teamKey: '466.l.12345.t.1',
        teamName: 'Test Team',
        leagueKey: '466.l.12345',
        managerName: undefined,
        managerGuid: undefined,
      });
    });

    it('should return null when teamData is null', () => {
      // ACT
      const result = parseTeam(null, '466.l.12345');

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid team data: missing team properties', { leagueKey: '466.l.12345' });
    });

    it('should return null when teamData is undefined', () => {
      // ACT
      const result = parseTeam(undefined, '466.l.12345');

      // ASSERT
      expect(result).toBeNull();
    });

    it('should return null when teamData[0] is not an array', () => {
      // ARRANGE
      const teamData = [{ not: 'an array' }];

      // ACT
      const result = parseTeam(teamData as any, '466.l.12345');

      // ASSERT
      expect(result).toBeNull();
    });

    it('should return null when properties array is empty', () => {
      // ARRANGE
      const teamData = [[]];

      // ACT
      const result = parseTeam(teamData, '466.l.12345');

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid team data: properties array is empty', { leagueKey: '466.l.12345' });
    });

    it('should return null when team_key is missing', () => {
      // ARRANGE
      const teamData = [
        [
          {
            name: 'Test Team',
            // Missing team_key
          },
        ],
      ];

      // ACT
      const result = parseTeam(teamData, '466.l.12345');

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid team data: team_key not found', { leagueKey: '466.l.12345' });
    });

    it('should use default team name when name is missing', () => {
      // ARRANGE
      const teamData = [
        [
          {
            team_key: '466.l.12345.t.1',
            // Missing name
          },
        ],
      ];

      // ACT
      const result = parseTeam(teamData, '466.l.12345');

      // ASSERT
      expect(result?.teamName).toBe('Unknown Team');
    });

    it('should handle missing managers', () => {
      // ARRANGE
      const teamData = [
        [
          {
            team_key: '466.l.12345.t.1',
            name: 'Test Team',
            // Missing managers
          },
        ],
      ];

      // ACT
      const result = parseTeam(teamData, '466.l.12345');

      // ASSERT
      expect(result).toEqual({
        teamKey: '466.l.12345.t.1',
        teamName: 'Test Team',
        leagueKey: '466.l.12345',
        managerName: undefined,
        managerGuid: undefined,
      });
    });

    it('should handle managers array format', () => {
      // ARRANGE
      const teamData = [
        [
          {
            team_key: '466.l.12345.t.1',
            name: 'Test Team',
            managers: [
              {
                manager: {
                  nickname: 'John Doe',
                  guid: 'guid-123',
                },
              },
            ],
          },
        ],
      ];

      // ACT
      const result = parseTeam(teamData, '466.l.12345');

      // ASSERT
      expect(result?.managerName).toBe('John Doe');
      expect(result?.managerGuid).toBe('guid-123');
    });

    it('should handle parsing errors gracefully', () => {
      // ARRANGE - Create data that will cause an error in the try block
      // We'll make teamKeyObj undefined to cause an error when accessing teamKeyObj.team_key
      const teamData = [
        [
          {
            // Missing team_key to cause error
            name: 'Test Team',
          },
        ],
      ];

      // Mock find to return undefined for team_key, then throw error in try block
      const originalFind = Array.prototype.find;
      let callCount = 0;
      Array.prototype.find = vi.fn(function(this: any[], predicate: any) {
        callCount++;
        if (callCount === 1) {
          // First find (team_key) - return undefined
          return undefined;
        }
        // Other finds use original
        return originalFind.call(this, predicate);
      });

      // ACT
      const result = parseTeam(teamData, '466.l.12345');

      // ASSERT - Should return null due to missing team_key
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Invalid team data: team_key not found', { leagueKey: '466.l.12345' });

      // Restore
      Array.prototype.find = originalFind;
    });
  });

  describe('parseTeamsFromStandings', () => {
    it('should parse multiple teams from standings', () => {
      // ARRANGE
      const standingsData = {
        standings: [
          {
            teams: {
              count: 2,
              '0': {
                team: [
                  [
                    {
                      team_key: '466.l.12345.t.1',
                      name: 'Team 1',
                    },
                  ],
                ],
              },
              '1': {
                team: [
                  [
                    {
                      team_key: '466.l.12345.t.2',
                      name: 'Team 2',
                    },
                  ],
                ],
              },
            },
          },
        ],
      };
      const leagueKey = '466.l.12345';

      // ACT
      const result = parseTeamsFromStandings(standingsData, leagueKey);

      // ASSERT
      expect(result).toHaveLength(2);
      expect(result[0].teamKey).toBe('466.l.12345.t.1');
      expect(result[1].teamKey).toBe('466.l.12345.t.2');
    });

    it('should return empty array when standings is missing', () => {
      // ARRANGE
      const standingsData = {};

      // ACT
      const result = parseTeamsFromStandings(standingsData, '466.l.12345');

      // ASSERT
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('Invalid standings data: missing or empty standings', { leagueKey: '466.l.12345' });
    });

    it('should return empty array when standings is null', () => {
      // ACT
      const result = parseTeamsFromStandings(null, '466.l.12345');

      // ASSERT
      expect(result).toEqual([]);
    });

    it('should return empty array when standings is not an array', () => {
      // ARRANGE
      const standingsData = {
        standings: { not: 'an array' },
      };

      // ACT
      const result = parseTeamsFromStandings(standingsData, '466.l.12345');

      // ASSERT
      expect(result).toEqual([]);
    });

    it('should return empty array when standings array is empty', () => {
      // ARRANGE
      const standingsData = {
        standings: [],
      };

      // ACT
      const result = parseTeamsFromStandings(standingsData, '466.l.12345');

      // ASSERT
      expect(result).toEqual([]);
    });

    it('should return empty array when teams is missing', () => {
      // ARRANGE
      const standingsData = {
        standings: [{}],
      };

      // ACT
      const result = parseTeamsFromStandings(standingsData, '466.l.12345');

      // ASSERT
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('Invalid standings data: missing teams or count', { leagueKey: '466.l.12345' });
    });

    it('should return empty array when teams.count is missing', () => {
      // ARRANGE
      const standingsData = {
        standings: [
          {
            teams: {},
          },
        ],
      };

      // ACT
      const result = parseTeamsFromStandings(standingsData, '466.l.12345');

      // ASSERT
      expect(result).toEqual([]);
    });

    it('should skip invalid team data', () => {
      // ARRANGE
      const standingsData = {
        standings: [
          {
            teams: {
              count: 2,
              '0': {
                team: [
                  [
                    {
                      team_key: '466.l.12345.t.1',
                      name: 'Team 1',
                    },
                  ],
                ],
              },
              '1': null, // Invalid team
            },
          },
        ],
      };

      // ACT
      const result = parseTeamsFromStandings(standingsData, '466.l.12345');

      // ASSERT
      expect(result).toHaveLength(1);
      expect(result[0].teamKey).toBe('466.l.12345.t.1');
    });

    it('should handle teams with missing team data', () => {
      // ARRANGE
      const standingsData = {
        standings: [
          {
            teams: {
              count: 2,
              '0': {
                team: [
                  [
                    {
                      team_key: '466.l.12345.t.1',
                      name: 'Team 1',
                    },
                  ],
                ],
              },
              // '1' is missing
            },
          },
        ],
      };

      // ACT
      const result = parseTeamsFromStandings(standingsData, '466.l.12345');

      // ASSERT
      expect(result).toHaveLength(1);
    });
  });
});
