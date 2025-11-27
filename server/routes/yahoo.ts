import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { getValidAccessToken } from "../yahoo-auth";
import { requireAuth, getAuthenticatedUserId } from "../auth-routes";
import { getMCPClient } from "../mcp-client";

/** Register Yahoo Fantasy API data routes */
export function registerYahooRoutes(app: Express): void {
  // GET: Fetch all user's leagues and teams
  app.get("/api/yahoo/leagues", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
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
      try {
        await mcpClient.setCredentials(accessToken, token.refreshToken, token.expiresAt);
      } catch (credError: any) {
        console.error('Failed to set MCP credentials:', credError);
        return res.status(400).json({ error: "Yahoo Fantasy credentials not properly configured. Please reconnect your Yahoo account." });
      }

      let leaguesResponse;
      try {
        leaguesResponse = await mcpClient.getUserLeagues();
      } catch (leagueError: any) {
        console.error('Error calling getUserLeagues:', leagueError);
        if (leagueError.message?.includes('credentials') || leagueError.message?.includes('refresh') || leagueError.message?.includes('token')) {
          return res.status(400).json({ error: "Yahoo Fantasy credentials expired or invalid. Please reconnect your Yahoo account." });
        }
        throw leagueError;
      }
      
      const users = leaguesResponse?.fantasy_content?.users;
      if (!users || !users["0"]) {
        return res.json({ leagues: [] });
      }
      
      const userData = users["0"].user;
      const userGuid = userData[0]?.guid;
      
      if (!userData || userData.length < 2) {
        return res.json({ leagues: [] });
      }
      
      const gamesData = userData[1]?.games;
      if (!gamesData || !gamesData["0"]) {
        return res.json({ leagues: [] });
      }
      
      const gameArray = gamesData["0"].game;
      if (!gameArray || gameArray.length < 2) {
        return res.json({ leagues: [] });
      }
      
      const leaguesData = gameArray[1]?.leagues;
      if (!leaguesData) {
        return res.json({ leagues: [] });
      }
      
      const leagues = [];
      for (let i = 0; i < leaguesData.count; i++) {
        const leagueArray = leaguesData[i.toString()]?.league;
        if (leagueArray && Array.isArray(leagueArray) && leagueArray.length > 0) {
          const leagueKey = leagueArray[0]?.league_key;
          const leagueName = leagueArray[0]?.name;
          
          if (leagueKey) {
            const standings = await mcpClient.getLeagueStandings(leagueKey);
            const teams = standings?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;
            
            let userTeam = null;
            if (teams) {
              for (let j = 0; j < teams.count; j++) {
                const teamData = teams[j.toString()]?.team;
                if (teamData && Array.isArray(teamData) && teamData[0] && Array.isArray(teamData[0])) {
                  const teamProperties = teamData[0];
                  const teamKeyObj = teamProperties.find((prop: any) => prop.team_key);
                  const teamNameObj = teamProperties.find((prop: any) => prop.name);
                  const managersObj = teamProperties.find((prop: any) => prop.managers);
                  
                  const managers = managersObj?.managers;
                  if (managers && Array.isArray(managers)) {
                    const manager = managers[0]?.manager;
                    if (manager?.guid === userGuid) {
                      userTeam = {
                        teamKey: teamKeyObj?.team_key,
                        teamName: teamNameObj?.name
                      };
                      break;
                    }
                  }
                }
              }
            }
            
            if (userTeam) {
              leagues.push({
                leagueKey,
                leagueName,
                teamKey: userTeam.teamKey,
                teamName: userTeam.teamName
              });
            }
          }
        }
      }

      res.json({ leagues });
    } catch (error: any) {
      console.error('Error fetching leagues:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch leagues' });
    }
  });

  // GET: Fetch roster for specific team
  app.get("/api/yahoo/roster-by-team/:teamKey", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { teamKey } = req.params;
      if (!teamKey) {
        return res.status(400).json({ error: "Team key required" });
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

      const rosterData = await mcpClient.getTeamRoster(teamKey);
      const playersData = rosterData?.fantasy_content?.team?.[1]?.roster?.[0]?.players;
      if (!playersData) {
        return res.json({ roster: [] });
      }
      
      const roster = [];
      for (let i = 0; i < playersData.count; i++) {
        const playerArray = playersData[i.toString()]?.player;
        if (playerArray && Array.isArray(playerArray) && playerArray[0]) {
          const playerProperties = playerArray[0];
          if (Array.isArray(playerProperties)) {
            const nameObj = playerProperties.find((p: any) => p.name);
            const posObj = playerProperties.find((p: any) => p.display_position);
            const primaryPosObj = playerProperties.find((p: any) => p.primary_position);
            const teamObj = playerProperties.find((p: any) => p.editorial_team_abbr);
            const statusObj = playerProperties.find((p: any) => p.status);
            const keyObj = playerProperties.find((p: any) => p.player_key);
            
            roster.push({
              name: nameObj?.name?.full || "Unknown Player",
              position: posObj?.display_position || primaryPosObj?.primary_position || "N/A",
              team: teamObj?.editorial_team_abbr || "N/A",
              status: !statusObj || statusObj.status === "" ? "active" : 
                      statusObj.status === "IL" || statusObj.status === "IL+" ? "injured" :
                      statusObj.status === "O" || statusObj.status === "GTD" || statusObj.status === "INJ" ? "out" : "active",
              playerKey: keyObj?.player_key || "",
            });
          }
        }
      }

      res.json({ roster });
    } catch (error: any) {
      console.error('Error fetching roster:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch roster' });
    }
  });
}
