import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseMatchup,
  parseMatchupsFromScoreboard,
  extractTeamFromScoreboard,
} from '../../../../../server/services/parsers/matchup-parser';

// Mock logger
vi.mock('../../../../../server/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('matchup-parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseMatchup', () => {
    const leagueKey = '466.l.12345';
    const week = 5;

    it('should return null for null matchup data', () => {
      // ARRANGE & ACT
      const result = parseMatchup(null, leagueKey, week);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should return null for undefined matchup data', () => {
      // ARRANGE & ACT
      const result = parseMatchup(undefined, leagueKey, week);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should return null when teams are missing', () => {
      // ARRANGE
      const matchupData = [
        { status: 'postevent' },
        {}, // No teams
      ];

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should return null when team 0 data is missing', () => {
      // ARRANGE
      const matchupData = [
        { status: 'postevent' },
        {
          teams: {
            '1': { team: [[], {}] },
          },
        },
      ];

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should parse valid matchup data correctly', () => {
      // ARRANGE
      const matchupData = [
        { status: 'postevent' },
        {
          teams: {
            '0': {
              team: [
                [{ team_key: '466.l.12345.t.1' }],
                {},
              ],
              team_points: { wins: 5, losses: 4, ties: 0 },
            },
            '1': {
              team: [
                [{ team_key: '466.l.12345.t.2' }],
                {},
              ],
              team_points: { wins: 4, losses: 5, ties: 0 },
            },
          },
        },
      ];

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result).not.toBeNull();
      expect(result?.leagueKey).toBe(leagueKey);
      expect(result?.week).toBe(week);
      expect(result?.team1Key).toBe('466.l.12345.t.1');
      expect(result?.team2Key).toBe('466.l.12345.t.2');
      expect(result?.status).toBe('completed');
    });

    it('should parse matchup with live status', () => {
      // ARRANGE
      const matchupData = [
        { status: 'live' },
        {
          teams: {
            '0': {
              team: [
                [{ team_key: '466.l.12345.t.1' }],
                {},
              ],
            },
            '1': {
              team: [
                [{ team_key: '466.l.12345.t.2' }],
                {},
              ],
            },
          },
        },
      ];

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result?.status).toBe('live');
    });

    it('should parse matchup with upcoming status (no status provided)', () => {
      // ARRANGE
      const matchupData = [
        {}, // No status
        {
          teams: {
            '0': {
              team: [
                [{ team_key: '466.l.12345.t.1' }],
                {},
              ],
            },
            '1': {
              team: [
                [{ team_key: '466.l.12345.t.2' }],
                {},
              ],
            },
          },
        },
      ];

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result?.status).toBe('upcoming');
    });

    it('should parse scores correctly', () => {
      // ARRANGE
      const matchupData = [
        { status: 'postevent' },
        {
          teams: {
            '0': {
              team: [
                [{ team_key: '466.l.12345.t.1' }],
                {},
              ],
              team_points: { wins: 7, losses: 2, ties: 0 },
            },
            '1': {
              team: [
                [{ team_key: '466.l.12345.t.2' }],
                {},
              ],
              team_points: { wins: 2, losses: 7, ties: 0 },
            },
          },
        },
      ];

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result?.team1Score).toEqual({ wins: 7, losses: 2, ties: 0 });
      expect(result?.team2Score).toEqual({ wins: 2, losses: 7, ties: 0 });
    });

    it('should default scores to 0 when not provided', () => {
      // ARRANGE
      const matchupData = [
        {},
        {
          teams: {
            '0': {
              team: [
                [{ team_key: '466.l.12345.t.1' }],
                {},
              ],
              // No team_points
            },
            '1': {
              team: [
                [{ team_key: '466.l.12345.t.2' }],
                {},
              ],
            },
          },
        },
      ];

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result?.team1Score).toEqual({ wins: 0, losses: 0, ties: 0 });
      expect(result?.team2Score).toEqual({ wins: 0, losses: 0, ties: 0 });
    });
  });

  describe('parseMatchupsFromScoreboard', () => {
    const leagueKey = '466.l.12345';
    const week = 5;

    it('should return empty array for null data', () => {
      // ARRANGE & ACT
      const result = parseMatchupsFromScoreboard(null, leagueKey, week);

      // ASSERT
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined data', () => {
      // ARRANGE & ACT
      const result = parseMatchupsFromScoreboard(undefined, leagueKey, week);

      // ASSERT
      expect(result).toEqual([]);
    });

    it('should return empty array when fantasy_content is missing', () => {
      // ARRANGE
      const data = {};

      // ACT
      const result = parseMatchupsFromScoreboard(data as any, leagueKey, week);

      // ASSERT
      expect(result).toEqual([]);
    });

    it('should return empty array when league is missing', () => {
      // ARRANGE
      const data = {
        fantasy_content: {},
      };

      // ACT
      const result = parseMatchupsFromScoreboard(data as any, leagueKey, week);

      // ASSERT
      expect(result).toEqual([]);
    });

    it('should return empty array when scoreboard is missing', () => {
      // ARRANGE
      const data = {
        fantasy_content: {
          league: [
            {},
            {}, // No scoreboard
          ],
        },
      };

      // ACT
      const result = parseMatchupsFromScoreboard(data as any, leagueKey, week);

      // ASSERT
      expect(result).toEqual([]);
    });

    it('should parse multiple matchups from scoreboard', () => {
      // ARRANGE
      const data = {
        fantasy_content: {
          league: [
            {},
            {
              scoreboard: [
                {
                  matchups: {
                    count: 2,
                    '0': {
                      matchup: [
                        {},
                        {
                          teams: {
                            '0': {
                              team: [[{ team_key: '466.l.12345.t.1' }], {}],
                            },
                            '1': {
                              team: [[{ team_key: '466.l.12345.t.2' }], {}],
                            },
                          },
                        },
                      ],
                    },
                    '1': {
                      matchup: [
                        {},
                        {
                          teams: {
                            '0': {
                              team: [[{ team_key: '466.l.12345.t.3' }], {}],
                            },
                            '1': {
                              team: [[{ team_key: '466.l.12345.t.4' }], {}],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      };

      // ACT
      const result = parseMatchupsFromScoreboard(data as any, leagueKey, week);

      // ASSERT
      expect(result).toHaveLength(2);
      expect(result[0].team1Key).toBe('466.l.12345.t.1');
      expect(result[0].team2Key).toBe('466.l.12345.t.2');
      expect(result[1].team1Key).toBe('466.l.12345.t.3');
      expect(result[1].team2Key).toBe('466.l.12345.t.4');
    });

    it('should handle scoreboard in object format', () => {
      // ARRANGE
      const data = {
        fantasy_content: {
          league: [
            {},
            {
              scoreboard: {
                '0': {
                  matchups: {
                    count: 1,
                    '0': {
                      matchup: [
                        {},
                        {
                          teams: {
                            '0': {
                              team: [[{ team_key: '466.l.12345.t.1' }], {}],
                            },
                            '1': {
                              team: [[{ team_key: '466.l.12345.t.2' }], {}],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      };

      // ACT
      const result = parseMatchupsFromScoreboard(data as any, leagueKey, week);

      // ASSERT
      expect(result).toHaveLength(1);
      expect(result[0].team1Key).toBe('466.l.12345.t.1');
    });
  });

  describe('extractTeamFromScoreboard', () => {
    const week = 5;

    it('should return null for null data', () => {
      // ARRANGE & ACT
      const result = extractTeamFromScoreboard(null, '466.l.12345.t.1', week);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should return null when team not found', () => {
      // ARRANGE
      const data = {
        fantasy_content: {
          league: [
            {},
            {
              scoreboard: [
                {
                  matchups: {
                    count: 1,
                    '0': {
                      matchup: {
                        '0': {
                          teams: {
                            count: 2,
                            '0': {
                              team: [[{ team_key: '466.l.12345.t.1' }], {}],
                            },
                            '1': {
                              team: [[{ team_key: '466.l.12345.t.2' }], {}],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      };

      // ACT
      const result = extractTeamFromScoreboard(data as any, '466.l.12345.t.99', week);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should return team data when found', () => {
      // ARRANGE
      const teamData = [[{ team_key: '466.l.12345.t.1' }, { name: 'Test Team' }], { team_points: { wins: 5 } }];
      const data = {
        fantasy_content: {
          league: [
            {},
            {
              scoreboard: [
                {
                  matchups: {
                    count: 1,
                    '0': {
                      matchup: {
                        '0': {
                          teams: {
                            count: 2,
                            '0': {
                              team: teamData,
                            },
                            '1': {
                              team: [[{ team_key: '466.l.12345.t.2' }], {}],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      };

      // ACT
      const result = extractTeamFromScoreboard(data as any, '466.l.12345.t.1', week);

      // ASSERT
      expect(result).not.toBeNull();
      expect(result).toEqual(teamData);
    });
  });

  describe('status parsing', () => {
    const leagueKey = '466.l.12345';
    const week = 5;

    const createMatchupWithStatus = (status?: string) => [
      status ? { status } : {},
      {
        teams: {
          '0': { team: [[{ team_key: '466.l.12345.t.1' }], {}] },
          '1': { team: [[{ team_key: '466.l.12345.t.2' }], {}] },
        },
      },
    ];

    it('should parse "postevent" as completed', () => {
      // ARRANGE
      const matchupData = createMatchupWithStatus('postevent');

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result?.status).toBe('completed');
    });

    it('should parse "post" as completed', () => {
      // ARRANGE
      const matchupData = createMatchupWithStatus('post');

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result?.status).toBe('completed');
    });

    it('should parse "live" as live', () => {
      // ARRANGE
      const matchupData = createMatchupWithStatus('live');

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result?.status).toBe('live');
    });

    it('should parse "inprogress" as live', () => {
      // ARRANGE
      const matchupData = createMatchupWithStatus('inprogress');

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result?.status).toBe('live');
    });

    it('should parse undefined status as upcoming', () => {
      // ARRANGE
      const matchupData = createMatchupWithStatus(undefined);

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result?.status).toBe('upcoming');
    });

    it('should parse unknown status as upcoming', () => {
      // ARRANGE
      const matchupData = createMatchupWithStatus('unknown');

      // ACT
      const result = parseMatchup(matchupData as any, leagueKey, week);

      // ASSERT
      expect(result?.status).toBe('upcoming');
    });
  });
});
