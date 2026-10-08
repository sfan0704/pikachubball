import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseTeam,
  parseTeamsFromStandings,
} from "../../../../../server/fantasy/legacy/league-parser";
import { logger } from "../../../../../server/utils/logger";

// Mock logger
vi.mock("../../../../../server/utils/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("league-parser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseTeam", () => {
    it("should parse valid team data", () => {
      // ARRANGE
      const teamData = [
        [
          {
            team_key: "466.l.12345.t.1",
            name: "Test Team",
            managers: [
              {
                manager: {
                  nickname: "John Doe",
                  guid: "guid-123",
                },
              },
            ],
          },
        ],
      ];
      const leagueKey = "466.l.12345";

      // ACT
      const result = parseTeam(teamData, leagueKey);

      // ASSERT
      expect(result).toEqual({
        teamKey: "466.l.12345.t.1",
        teamName: "Test Team",
        leagueKey: "466.l.12345",
        managerName: "John Doe",
        managerGuid: "guid-123",
      });
    });

    it("should parse valid team data without managers", () => {
      // ARRANGE
      const teamData = [
        [
          {
            team_key: "466.l.12345.t.1",
            name: "Test Team",
          },
        ],
      ];
      const leagueKey = "466.l.12345";

      // ACT
      const result = parseTeam(teamData, leagueKey);

      // ASSERT
      expect(result).toEqual({
        teamKey: "466.l.12345.t.1",
        teamName: "Test Team",
        leagueKey: "466.l.12345",
        managerName: undefined,
        managerGuid: undefined,
      });
    });

    it("should return null when teamData is null", () => {
      // ACT
      const result = parseTeam(null, "466.l.12345");

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Invalid team data: missing team properties", {
        leagueKey: "466.l.12345",
      });
    });

    it("should return null when teamData is undefined", () => {
      // ACT
      const result = parseTeam(undefined, "466.l.12345");

      // ASSERT
      expect(result).toBeNull();
    });

    it("should return null when teamData[0] is not an array", () => {
      // ARRANGE
      const teamData = [{ not: "an array" }];

      // ACT
      const result = parseTeam(teamData as any, "466.l.12345");

      // ASSERT
      expect(result).toBeNull();
    });

    it("should return null when properties array is empty", () => {
      // ARRANGE
      const teamData = [[]];

      // ACT
      const result = parseTeam(teamData, "466.l.12345");

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Invalid team data: properties array is empty", {
        leagueKey: "466.l.12345",
      });
    });

    it("should return null when team_key is missing", () => {
      // ARRANGE
      const teamData = [
        [
          {
            name: "Test Team",
            // Missing team_key
          },
        ],
      ];

      // ACT
      const result = parseTeam(teamData, "466.l.12345");

      // ASSERT
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Invalid team data: team_key not found", {
        leagueKey: "466.l.12345",
      });
    });

    it("should use default team name when name is missing", () => {
      // ARRANGE
      const teamData = [
        [
          {
            team_key: "466.l.12345.t.1",
            // Missing name
          },
        ],
      ];

      // ACT
      const result = parseTeam(teamData, "466.l.12345");

      // ASSERT
      expect(result?.teamName).toBe("Unknown Team");
    });

    it("should handle missing managers", () => {
      // ARRANGE
      const teamData = [
        [
          {
            team_key: "466.l.12345.t.1",
            name: "Test Team",
            // Missing managers
          },
        ],
      ];

      // ACT
      const result = parseTeam(teamData, "466.l.12345");

      // ASSERT
      expect(result).toEqual({
        teamKey: "466.l.12345.t.1",
        teamName: "Test Team",
        leagueKey: "466.l.12345",
        managerName: undefined,
        managerGuid: undefined,
      });
    });

    it("should handle managers array format", () => {
      // ARRANGE
      const teamData = [
        [
          {
            team_key: "466.l.12345.t.1",
            name: "Test Team",
            managers: [
              {
                manager: {
                  nickname: "John Doe",
                  guid: "guid-123",
                },
              },
            ],
          },
        ],
      ];

      // ACT
      const result = parseTeam(teamData, "466.l.12345");

      // ASSERT
      expect(result?.managerName).toBe("John Doe");
      expect(result?.managerGuid).toBe("guid-123");
    });

    it("should handle parsing errors gracefully", () => {
      // ARRANGE - Create data that will cause an error in the try block
      // We'll make teamKeyObj undefined to cause an error when accessing teamKeyObj.team_key
      const teamData = [
        [
          {
            // Missing team_key to cause error
            name: "Test Team",
          },
        ],
      ];

      // Mock find to return undefined for team_key, then throw error in try block
      const originalFind = Array.prototype.find;
      let callCount = 0;
      Array.prototype.find = vi.fn(function (this: any[], predicate: any) {
        callCount++;
        if (callCount === 1) {
          // First find (team_key) - return undefined
          return undefined;
        }
        // Other finds use original
        return originalFind.call(this, predicate);
      });

      // ACT
      const result = parseTeam(teamData, "466.l.12345");

      // ASSERT - Should return null due to missing team_key
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith("Invalid team data: team_key not found", {
        leagueKey: "466.l.12345",
      });

      // Restore
      Array.prototype.find = originalFind;
    });
  });

  describe("parseTeamsFromStandings", () => {
    it("should parse multiple teams from standings", () => {
      // ARRANGE
      const standingsData = {
        standings: [
          {
            teams: {
              count: 2,
              "0": {
                team: [
                  [
                    {
                      team_key: "466.l.12345.t.1",
                      name: "Team 1",
                    },
                  ],
                ],
              },
              "1": {
                team: [
                  [
                    {
                      team_key: "466.l.12345.t.2",
                      name: "Team 2",
                    },
                  ],
                ],
              },
            },
          },
        ],
      };
      const leagueKey = "466.l.12345";

      // ACT
      const result = parseTeamsFromStandings(standingsData, leagueKey);

      // ASSERT
      expect(result).toHaveLength(2);
      expect(result[0].teamKey).toBe("466.l.12345.t.1");
      expect(result[1].teamKey).toBe("466.l.12345.t.2");
    });

    it("should return empty array when standings is missing", () => {
      // ARRANGE
      const standingsData = {};

      // ACT
      const result = parseTeamsFromStandings(standingsData, "466.l.12345");

      // ASSERT
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        "Invalid standings data: missing or empty standings",
        { leagueKey: "466.l.12345" }
      );
    });

    it("should return empty array when standings is null", () => {
      // ACT
      const result = parseTeamsFromStandings(null, "466.l.12345");

      // ASSERT
      expect(result).toEqual([]);
    });

    it("should return empty array when standings is not an array", () => {
      // ARRANGE
      const standingsData = {
        standings: { not: "an array" },
      };

      // ACT
      const result = parseTeamsFromStandings(standingsData, "466.l.12345");

      // ASSERT
      expect(result).toEqual([]);
    });

    it("should return empty array when standings array is empty", () => {
      // ARRANGE
      const standingsData = {
        standings: [],
      };

      // ACT
      const result = parseTeamsFromStandings(standingsData, "466.l.12345");

      // ASSERT
      expect(result).toEqual([]);
    });

    it("should return empty array when teams is missing", () => {
      // ARRANGE
      const standingsData = {
        standings: [{}],
      };

      // ACT
      const result = parseTeamsFromStandings(standingsData, "466.l.12345");

      // ASSERT
      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith("Invalid standings data: missing teams or count", {
        leagueKey: "466.l.12345",
      });
    });

    it("should return empty array when teams.count is missing", () => {
      // ARRANGE
      const standingsData = {
        standings: [
          {
            teams: {},
          },
        ],
      };

      // ACT
      const result = parseTeamsFromStandings(standingsData, "466.l.12345");

      // ASSERT
      expect(result).toEqual([]);
    });

    it("should skip invalid team data", () => {
      // ARRANGE
      const standingsData = {
        standings: [
          {
            teams: {
              count: 2,
              "0": {
                team: [
                  [
                    {
                      team_key: "466.l.12345.t.1",
                      name: "Team 1",
                    },
                  ],
                ],
              },
              "1": null, // Invalid team
            },
          },
        ],
      };

      // ACT
      const result = parseTeamsFromStandings(standingsData, "466.l.12345");

      // ASSERT
      expect(result).toHaveLength(1);
      expect(result[0].teamKey).toBe("466.l.12345.t.1");
    });

    it("should handle teams with missing team data", () => {
      // ARRANGE
      const standingsData = {
        standings: [
          {
            teams: {
              count: 2,
              "0": {
                team: [
                  [
                    {
                      team_key: "466.l.12345.t.1",
                      name: "Team 1",
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
      const result = parseTeamsFromStandings(standingsData, "466.l.12345");

      // ASSERT
      expect(result).toHaveLength(1);
    });
  });
});
