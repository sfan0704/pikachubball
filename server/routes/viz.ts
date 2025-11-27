import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { getValidAccessToken } from "../yahoo-auth";
import { requireAuth, getAuthenticatedUserId } from "../auth-routes";
import { getMCPClient } from "../mcp-client";
import { YahooMCPDataSource } from "../services/fantasy-data-source";
import { getLeagueRankings, getLeagueHeatmap } from "../services/viz/league-viz";
import { getMatchupComparison } from "../services/viz/matchup-viz";
import { getScheduleMatrix } from "../services/viz/schedule-viz";

/** Register visualization routes for league rankings, matchups, schedules */
export function registerVizRoutes(app: Express): void {
  // GET: League rankings (9-cat standings)
  app.get("/api/yahoo/league-rankings/:leagueKey", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { leagueKey } = req.params;
      const weekParam = req.query.week;
      let week: number | undefined;
      
      if (!leagueKey) {
        return res.status(400).json({ error: "League key required" });
      }

      if (weekParam) {
        const parsed = parseInt(weekParam as string, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          return res.status(400).json({ error: "Week must be a positive integer" });
        }
        week = parsed;
      }

      const token = await storage.getYahooToken(userId);
      if (!token) {
        return res.status(400).json({ error: "Yahoo Fantasy not connected" });
      }

      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        return res.status(401).json({ error: "Invalid or expired Yahoo token" });
      }

      const mcpClient = await getMCPClient();
      await mcpClient.setCredentials(accessToken, token.refreshToken, token.expiresAt);

      const dataSource = new YahooMCPDataSource(mcpClient);
      const response = await getLeagueRankings(dataSource, leagueKey, week);

      res.json(response);
    } catch (error: any) {
      console.error('Error fetching league rankings:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch league rankings' });
    }
  });

  // GET: League heatmap visualization
  app.get("/api/viz/heatmap/:leagueKey", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { leagueKey } = req.params;
      const weekParam = req.query.week;
      let week: number | undefined;
      
      if (!leagueKey) {
        return res.status(400).json({ error: "League key required" });
      }

      if (weekParam) {
        const parsed = parseInt(weekParam as string, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          return res.status(400).json({ error: "Week must be a positive integer" });
        }
        week = parsed;
      }

      const token = await storage.getYahooToken(userId);
      if (!token) {
        return res.status(400).json({ error: "Yahoo Fantasy not connected" });
      }

      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        return res.status(401).json({ error: "Invalid or expired Yahoo token" });
      }

      const mcpClient = await getMCPClient();
      await mcpClient.setCredentials(accessToken, token.refreshToken, token.expiresAt);

      const dataSource = new YahooMCPDataSource(mcpClient);
      const response = await getLeagueHeatmap(dataSource, leagueKey, week);

      res.json(response);
    } catch (error: any) {
      console.error('Error fetching league heatmap:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch league heatmap' });
    }
  });

  // GET: Matchup comparison visualization
  app.get("/api/viz/matchup/:leagueKey/:teamKey", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { leagueKey, teamKey } = req.params;
      const weekParam = req.query.week;
      const opponentTeamKeyParam = req.query.opponentTeamKey as string | undefined;
      let week: number | undefined;
      
      if (!leagueKey || !teamKey) {
        return res.status(400).json({ error: "League key and team key required" });
      }

      if (weekParam) {
        const parsed = parseInt(weekParam as string, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          return res.status(400).json({ error: "Week must be a positive integer" });
        }
        week = parsed;
      }

      const token = await storage.getYahooToken(userId);
      if (!token) {
        return res.status(400).json({ error: "Yahoo Fantasy not connected" });
      }

      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        return res.status(401).json({ error: "Invalid or expired Yahoo token" });
      }

      const mcpClient = await getMCPClient();
      await mcpClient.setCredentials(accessToken, token.refreshToken, token.expiresAt);

      const dataSource = new YahooMCPDataSource(mcpClient);
      const effectiveOpponentTeamKey = opponentTeamKeyParam || undefined;
      const response = await getMatchupComparison(dataSource, leagueKey, teamKey, week, effectiveOpponentTeamKey);

      res.json(response);
    } catch (error: any) {
      console.error('Error fetching matchup comparison:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch matchup comparison' });
    }
  });

  // GET: Schedule visualization (games remaining)
  app.get("/api/viz/schedule/:leagueKey/:teamKey", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { leagueKey, teamKey } = req.params;
      const weekParam = req.query.week;
      const opponentTeamKey = req.query.opponentTeamKey as string | undefined;
      let week: number | undefined;
      
      if (!leagueKey || !teamKey) {
        return res.status(400).json({ error: "League key and team key required" });
      }

      if (weekParam) {
        const parsed = parseInt(weekParam as string, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          return res.status(400).json({ error: "Week must be a positive integer" });
        }
        week = parsed;
      }

      const token = await storage.getYahooToken(userId);
      if (!token) {
        return res.status(400).json({ error: "Yahoo Fantasy not connected" });
      }

      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        return res.status(401).json({ error: "Invalid or expired Yahoo token" });
      }

      const mcpClient = await getMCPClient();
      await mcpClient.setCredentials(accessToken, token.refreshToken, token.expiresAt);

      const dataSource = new YahooMCPDataSource(mcpClient);
      const response = await getScheduleMatrix(dataSource, leagueKey, teamKey, week, opponentTeamKey);

      res.json(response);
    } catch (error: any) {
      console.error('Error fetching schedule matrix:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch schedule matrix' });
    }
  });
}
