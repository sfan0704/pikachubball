import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTeamRoster } from "../../../../../server/fantasy/yahoo/roster-service";
import { testTeamKey } from "../../../fixtures/test-data";

const getYahooApiClient = vi.fn();

describe("roster-service", () => {
  let mockYahooApiClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a mock YahooApiClient
    mockYahooApiClient = {
      getTeamRoster: vi.fn().mockResolvedValue({
        fantasy_content: {
          team: [
            [{ team_key: testTeamKey }],
            {
              roster: [
                {
                  players: {
                    count: 2,
                    "0": {
                      player: [
                        [{ player_key: "466.p.123" }],
                        { name: { full: "LeBron James" } },
                        { display_position: "SF" },
                        { editorial_team_abbr: "LAL" },
                        { status: "" },
                      ],
                    },
                    "1": {
                      player: [
                        [{ player_key: "466.p.456" }],
                        { name: { full: "Stephen Curry" } },
                        { display_position: "PG" },
                        { editorial_team_abbr: "GSW" },
                        { status: "" },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
    };

    getYahooApiClient.mockResolvedValue(mockYahooApiClient);
  });

  describe("getTeamRoster", () => {
    it("should return roster for a team", async () => {
      // ACT
      const roster = await getTeamRoster(testTeamKey, getYahooApiClient);

      // ASSERT
      expect(Array.isArray(roster)).toBe(true);
      if (roster.length > 0) {
        expect(roster[0]).toHaveProperty("name");
        expect(roster[0]).toHaveProperty("position");
        expect(roster[0]).toHaveProperty("team");
        expect(roster[0]).toHaveProperty("status");
        expect(roster[0]).toHaveProperty("playerKey");
      }
      expect(getYahooApiClient).toHaveBeenCalledOnce();
      expect(mockYahooApiClient.getTeamRoster).toHaveBeenCalledWith(testTeamKey);
    });

    it("should return empty array if no roster data", async () => {
      // ARRANGE
      // Create a client that returns empty roster
      const emptyClient = {
        getTeamRoster: vi.fn().mockResolvedValue({
          fantasy_content: { team: [{}, { roster: [{ players: null }] }] },
        }),
      };
      getYahooApiClient.mockResolvedValue(emptyClient);

      // ACT
      const roster = await getTeamRoster(testTeamKey, getYahooApiClient);

      // ASSERT
      expect(roster).toEqual([]);
    });

    it("should parse player status correctly", async () => {
      // ACT
      const roster = await getTeamRoster(testTeamKey, getYahooApiClient);

      // ASSERT
      roster.forEach((player) => {
        expect(["active", "injured", "out"]).toContain(player.status);
      });
    });

    it("should handle missing player data gracefully", async () => {
      // ARRANGE
      // Create a client that returns malformed player data
      const malformedClient = {
        getTeamRoster: vi.fn().mockResolvedValue({
          fantasy_content: {
            team: [
              {},
              {
                roster: [
                  {
                    players: {
                      count: 1,
                      "0": { player: null },
                    },
                  },
                ],
              },
            ],
          },
        }),
      };
      getYahooApiClient.mockResolvedValue(malformedClient);

      // ACT
      const roster = await getTeamRoster(testTeamKey, getYahooApiClient);

      // ASSERT
      // Should return empty array or handle gracefully
      expect(Array.isArray(roster)).toBe(true);
    });
  });
});
