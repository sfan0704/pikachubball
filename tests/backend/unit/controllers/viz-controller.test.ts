import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createVizController } from "../../../../server/controllers/viz-controller";
import { YahooFantasyDataSource } from "../../../../server/services/fantasy-data-source";
import { getLeagueRankings, getLeagueHeatmap } from "../../../../server/services/viz/league-viz";
import { getMatchupComparison } from "../../../../server/services/viz/matchup-viz";
import { ValidationError } from "../../../../shared/api/errors";
import {
  createAuthenticatedRequest,
  createMockResponse,
  createMockNext,
} from "../../fixtures/test-helpers";

// Mock dependencies
vi.mock("../../../../server/services/viz/league-viz");
vi.mock("../../../../server/services/viz/matchup-viz");

describe("vizController", () => {
  const vizController = createVizController();
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createAuthenticatedRequest() as Request;
    mockRes = createMockResponse() as Response;
    mockNext = createMockNext();
  });

  describe("getLeagueRankings", () => {
    it("should return league rankings", async () => {
      // ARRANGE
      const leagueKey = "466.l.12345";
      const week = 5;
      const mockResponse = {
        rankings: [],
        metadata: { scope: "week", week, currentWeek: 10, totalWeeks: 20 },
      };

      mockReq.params = { leagueKey };
      mockReq.query = { week: week.toString() };
      vi.mocked(getLeagueRankings).mockResolvedValue(mockResponse);

      // ACT
      const handler = vizController.getLeagueRankings as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(getLeagueRankings).toHaveBeenCalledWith(
        expect.any(YahooFantasyDataSource),
        leagueKey,
        week
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResponse);
    });

    it("should throw ValidationError if leagueKey is missing", async () => {
      // ARRANGE
      mockReq.params = {};

      // ACT
      const handler = vizController.getLeagueRankings as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("League key required");
      expect(getLeagueRankings).not.toHaveBeenCalled();
    });

    it("should handle optional week parameter", async () => {
      // ARRANGE
      const leagueKey = "466.l.12345";
      const mockResponse = {
        rankings: [],
        metadata: { scope: "season", currentWeek: 10, totalWeeks: 20 },
      };

      mockReq.params = { leagueKey };
      mockReq.query = {};
      vi.mocked(getLeagueRankings).mockResolvedValue(mockResponse);

      // ACT
      const handler = vizController.getLeagueRankings as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(getLeagueRankings).toHaveBeenCalledWith(
        expect.any(YahooFantasyDataSource),
        leagueKey,
        undefined
      );
    });
  });

  describe("getLeagueHeatmap", () => {
    it("should return league heatmap", async () => {
      // ARRANGE
      const leagueKey = "466.l.12345";
      const week = 5;
      const mockResponse = {
        heatmap: [],
        metadata: { scope: "week", week, currentWeek: 10, totalWeeks: 20 },
      };

      mockReq.params = { leagueKey };
      mockReq.query = { week: week.toString() };
      vi.mocked(getLeagueHeatmap).mockResolvedValue(mockResponse);

      // ACT
      const handler = vizController.getLeagueHeatmap as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(getLeagueHeatmap).toHaveBeenCalledWith(
        expect.any(YahooFantasyDataSource),
        leagueKey,
        week
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResponse);
    });

    it("should throw ValidationError if leagueKey is missing", async () => {
      // ARRANGE
      mockReq.params = {};

      // ACT
      const handler = vizController.getLeagueHeatmap as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("League key required");
    });
  });

  describe("getMatchupComparison", () => {
    it("should return matchup comparison", async () => {
      // ARRANGE
      const leagueKey = "466.l.12345";
      const teamKey = "466.l.12345.t.1";
      const week = 5;
      const opponentTeamKey = "466.l.12345.t.2";
      const mockResponse = {
        myTeam: { teamKey, teamName: "My Team" },
        opponent: { teamKey: opponentTeamKey, teamName: "Opponent" },
        categories: [],
        score: { wins: 5, losses: 4, ties: 0 },
        metadata: { scope: "week", week, currentWeek: 10, totalWeeks: 20 },
      };

      mockReq.params = { leagueKey, teamKey };
      mockReq.query = { week: week.toString(), opponentTeamKey };
      vi.mocked(getMatchupComparison).mockResolvedValue(mockResponse);

      // ACT
      const handler = vizController.getMatchupComparison as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(getMatchupComparison).toHaveBeenCalledWith(
        expect.any(YahooFantasyDataSource),
        leagueKey,
        teamKey,
        week,
        opponentTeamKey
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResponse);
    });

    it("should throw ValidationError if leagueKey is missing", async () => {
      // ARRANGE
      mockReq.params = { teamKey: "466.l.12345.t.1" };

      // ACT
      const handler = vizController.getMatchupComparison as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("League key and team key required");
    });

    it("should throw ValidationError if teamKey is missing", async () => {
      // ARRANGE
      mockReq.params = { leagueKey: "466.l.12345" };

      // ACT
      const handler = vizController.getMatchupComparison as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("League key and team key required");
    });
  });
});
