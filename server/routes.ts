import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  getAuthorizationUrl, 
  exchangeCodeForToken, 
  makeYahooApiRequest,
  generateState,
  validateState,
  YahooAuthError,
  getValidAccessToken
} from "./yahoo-auth";
import { registerAuthRoutes, requireAuth, getAuthenticatedUserId } from "./auth-routes";
import { encrypt, decrypt } from "./encryption";
import { z } from "zod";
import { getMCPClient } from "./mcp-client";

// Yahoo credentials schema for user input
const yahooCredentialsInputSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Register authentication routes
  registerAuthRoutes(app);

  // Yahoo Credentials Management Routes (Protected)
  app.post("/api/settings/yahoo-credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const validatedData = yahooCredentialsInputSchema.parse(req.body);

      // Encrypt credentials before storing
      const encryptedClientId = encrypt(validatedData.clientId);
      const encryptedClientSecret = encrypt(validatedData.clientSecret);

      await storage.saveYahooCredentials({
        userId,
        encryptedClientId,
        encryptedClientSecret,
      });

      res.json({ success: true, message: "Yahoo credentials saved successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Failed to save Yahoo credentials:", error);
      res.status(500).json({ error: "Failed to save credentials" });
    }
  });

  app.get("/api/settings/yahoo-credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const credentials = await storage.getYahooCredentials(userId);
      
      res.json({ 
        hasCredentials: !!credentials,
        updatedAt: credentials?.updatedAt || null,
      });
    } catch (error) {
      console.error("Failed to check Yahoo credentials:", error);
      res.status(500).json({ error: "Failed to check credentials" });
    }
  });

  app.delete("/api/settings/yahoo-credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      await storage.deleteYahooCredentials(userId);
      await storage.deleteYahooToken(userId); // Also delete tokens
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete Yahoo credentials:", error);
      res.status(500).json({ error: "Failed to delete credentials" });
    }
  });
  
  // Yahoo OAuth Routes (Protected)
  app.get("/api/auth/yahoo", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check if user has Yahoo credentials configured
      const credentials = await storage.getYahooCredentials(userId);
      if (!credentials) {
        return res.status(400).json({ 
          error: "Yahoo credentials not configured. Please add your Yahoo Client ID and Secret in Settings first." 
        });
      }

      const state = generateState();
      
      // Decrypt credentials and generate auth URL
      const clientId = decrypt(credentials.encryptedClientId);
      const authUrl = getAuthorizationUrl(state, clientId);
      
      res.json({ authUrl });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
  });

  app.get("/api/auth/yahoo/callback", async (req: Request, res: Response) => {
    const { code, state, error } = req.query;
    
    console.log('Yahoo OAuth callback received:', { 
      hasCode: !!code, 
      hasState: !!state, 
      error: error,
      isAuthenticated: req.isAuthenticated(),
      query: req.query 
    });
    
    // Check if Yahoo sent an error
    if (error) {
      console.error('Yahoo OAuth error:', error);
      return res.redirect(`/?error=yahoo_oauth_error&details=${error}`);
    }
    
    if (!code || typeof code !== 'string') {
      console.error('Missing authorization code in callback');
      return res.redirect('/?error=missing_code');
    }

    if (!state || typeof state !== 'string' || !validateState(state)) {
      console.error('Invalid or missing OAuth state parameter');
      return res.redirect('/?error=invalid_state');
    }

    try {
      // User must be logged in to complete OAuth
      if (!req.isAuthenticated()) {
        console.error('User not authenticated during OAuth callback');
        return res.redirect('/?error=not_authenticated');
      }

      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        console.error('Could not get authenticated user ID');
        return res.redirect('/?error=not_authenticated');
      }

      console.log('Processing OAuth for user:', userId);

      // Get user's Yahoo credentials
      const credentials = await storage.getYahooCredentials(userId);
      if (!credentials) {
        console.error('No Yahoo credentials found for user:', userId);
        return res.redirect('/?error=credentials_not_found');
      }

      // Decrypt credentials
      const clientId = decrypt(credentials.encryptedClientId);
      const clientSecret = decrypt(credentials.encryptedClientSecret);

      console.log('Exchanging code for token...');
      const tokens = await exchangeCodeForToken(code, clientId, clientSecret);
      
      const expiresAt = Math.floor(Date.now() / 1000) + tokens.expiresIn;
      
      await storage.saveYahooToken({
        userId: userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: expiresAt
      });

      console.log('Yahoo OAuth successful for user:', userId);
      res.redirect('/?yahoo_connected=true');
    } catch (error) {
      console.error('OAuth callback error:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      res.redirect('/?error=oauth_failed');
    }
  });

  app.get("/api/auth/yahoo/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const token = await storage.getYahooToken(userId);
      const credentials = await storage.getYahooCredentials(userId);
      
      res.json({ 
        hasCredentials: !!credentials,
        connected: !!token,
        hasValidToken: token ? token.expiresAt > Math.floor(Date.now() / 1000) : false
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check connection status' });
    }
  });

  app.delete("/api/auth/yahoo", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      await storage.deleteYahooToken(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to disconnect Yahoo account' });
    }
  });

  // Yahoo Fantasy API Routes - All require authentication
  
  // Get all user's leagues and teams
  app.get("/api/yahoo/leagues", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get user's Yahoo token
      const token = await storage.getYahooToken(userId);
      if (!token) {
        return res.status(400).json({ error: "Yahoo Fantasy not connected" });
      }

      // Get and validate token
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        return res.status(401).json({ error: "Invalid or expired Yahoo token" });
      }

      // Get MCP client and set credentials
      const mcpClient = await getMCPClient();
      await mcpClient.setCredentials(accessToken, token.refreshToken, token.expiresAt);

      // Get user's leagues
      const leaguesResponse = await mcpClient.getUserLeagues();
      
      // Parse the deeply nested Yahoo API structure
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
      
      // Extract all leagues
      const leagues = [];
      for (let i = 0; i < leaguesData.count; i++) {
        const leagueArray = leaguesData[i.toString()]?.league;
        if (leagueArray && Array.isArray(leagueArray) && leagueArray.length > 0) {
          const leagueKey = leagueArray[0]?.league_key;
          const leagueName = leagueArray[0]?.name;
          
          if (leagueKey) {
            // Get standings to find user's team in this league
            const standings = await mcpClient.getLeagueStandings(leagueKey);
            const teams = standings?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;
            
            // Find user's team
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

  // Get 9-cat rankings for all teams in a league
  app.get("/api/yahoo/league-rankings/:leagueKey", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { leagueKey } = req.params;
      if (!leagueKey) {
        return res.status(400).json({ error: "League key required" });
      }

      // Get user's Yahoo token
      const token = await storage.getYahooToken(userId);
      if (!token) {
        return res.status(400).json({ error: "Yahoo Fantasy not connected" });
      }

      // Get and validate token
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        return res.status(401).json({ error: "Invalid or expired Yahoo token" });
      }

      // Get MCP client and set credentials
      const mcpClient = await getMCPClient();
      await mcpClient.setCredentials(accessToken, token.refreshToken, token.expiresAt);

      // Get league standings which includes team stats
      const standings = await mcpClient.getLeagueStandings(leagueKey);
      
      // Parse team stats from Yahoo's nested structure
      const teams = standings?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;
      if (!teams) {
        return res.json({ rankings: [] });
      }

      // Extract all teams with their 9-cat stats
      const teamStats: Array<{
        teamKey: string;
        teamName: string;
        stats: {
          fgPct: number;
          ftPct: number;
          tpm: number;
          pts: number;
          reb: number;
          ast: number;
          stl: number;
          blk: number;
          to: number;
        };
      }> = [];
      for (let i = 0; i < teams.count; i++) {
        const teamData = teams[i.toString()]?.team;
        if (teamData && Array.isArray(teamData) && teamData[0] && Array.isArray(teamData[0])) {
          const teamProperties = teamData[0];
          const teamKeyObj = teamProperties.find((prop: any) => prop.team_key);
          const teamNameObj = teamProperties.find((prop: any) => prop.name);
          
          // Find team_stats in teamData[1]
          const statsData = teamData[1]?.team_stats;
          if (statsData) {
            const stats = statsData.stats;
            const statMap: any = {};
            
            // Parse stats into a map
            if (Array.isArray(stats)) {
              stats.forEach((statObj: any) => {
                if (statObj.stat) {
                  statMap[statObj.stat.stat_id] = statObj.stat.value;
                }
              });
            }
            
            teamStats.push({
              teamKey: teamKeyObj?.team_key,
              teamName: teamNameObj?.name,
              stats: {
                fgPct: parseFloat(statMap['5'] || '0'), // FG%
                ftPct: parseFloat(statMap['8'] || '0'), // FT%
                tpm: parseInt(statMap['10'] || '0'), // 3PM
                pts: parseInt(statMap['12'] || '0'), // PTS
                reb: parseInt(statMap['15'] || '0'), // REB
                ast: parseInt(statMap['16'] || '0'), // AST
                stl: parseInt(statMap['17'] || '0'), // STL
                blk: parseInt(statMap['18'] || '0'), // BLK
                to: parseInt(statMap['19'] || '0'), // TO
              }
            });
          }
        }
      }

      // Calculate rankings for each category
      const categories = ['fgPct', 'ftPct', 'tpm', 'pts', 'reb', 'ast', 'stl', 'blk', 'to'] as const;
      type CategoryKey = typeof categories[number];
      
      const rankings = teamStats.map(team => ({
        ...team,
        categoryRanks: {} as Record<CategoryKey, number>,
        totalRank: 0
      }));

      // Rank each category
      categories.forEach(cat => {
        // Sort teams by this category (descending for most, ascending for TO)
        const sorted = [...teamStats].sort((a, b) => {
          if (cat === 'to') {
            // Lower turnovers is better
            return a.stats[cat] - b.stats[cat];
          } else {
            // Higher is better
            return b.stats[cat] - a.stats[cat];
          }
        });

        // Assign ranks
        sorted.forEach((team, index) => {
          const rankingTeam = rankings.find(r => r.teamKey === team.teamKey);
          if (rankingTeam) {
            rankingTeam.categoryRanks[cat] = index + 1;
          }
        });
      });

      // Calculate total rank (average of all category ranks)
      rankings.forEach(team => {
        const totalRank = categories.reduce((sum, cat) => sum + team.categoryRanks[cat], 0);
        team.totalRank = totalRank / categories.length;
      });

      // Sort by master rank (lower is better)
      rankings.sort((a, b) => a.totalRank - b.totalRank);

      res.json({ rankings });
    } catch (error: any) {
      console.error('Error fetching league rankings:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch league rankings' });
    }
  });

  // Get roster for specific team
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

      // Get user's Yahoo token
      const token = await storage.getYahooToken(userId);
      if (!token) {
        return res.status(400).json({ error: "Yahoo Fantasy not connected" });
      }

      // Get and validate token
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        return res.status(401).json({ error: "Invalid or expired Yahoo token" });
      }

      // Get MCP client and set credentials
      const mcpClient = await getMCPClient();
      await mcpClient.setCredentials(accessToken, token.refreshToken, token.expiresAt);

      // Get team roster
      const rosterData = await mcpClient.getTeamRoster(teamKey);
      
      // Parse roster data from Yahoo's nested structure
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

  // Get user's roster via MCP (legacy endpoint - kept for compatibility)
  app.get("/api/yahoo/my-roster", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get user's Yahoo token
      const token = await storage.getYahooToken(userId);
      if (!token) {
        return res.status(400).json({ error: "Yahoo Fantasy not connected" });
      }

      // Get and validate token
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        return res.status(401).json({ error: "Invalid or expired Yahoo token" });
      }

      // Get MCP client and set credentials
      const mcpClient = await getMCPClient();
      await mcpClient.setCredentials(accessToken, token.refreshToken, token.expiresAt);

      // Get user's leagues
      const leaguesResponse = await mcpClient.getUserLeagues();
      
      console.log('Leagues response:', JSON.stringify(leaguesResponse, null, 2));
      
      // Parse the deeply nested Yahoo API structure
      const users = leaguesResponse?.fantasy_content?.users;
      if (!users || !users["0"]) {
        return res.json({ roster: [], message: "No user data found" });
      }
      
      const userData = users["0"].user;
      if (!userData || userData.length < 2) {
        return res.json({ roster: [], message: "No games data found" });
      }
      
      const gamesData = userData[1]?.games;
      if (!gamesData || !gamesData["0"]) {
        return res.json({ roster: [], message: "No games found" });
      }
      
      const gameArray = gamesData["0"].game;
      if (!gameArray || gameArray.length < 2) {
        return res.json({ roster: [], message: "No game leagues found" });
      }
      
      const leaguesData = gameArray[1]?.leagues;
      if (!leaguesData || !leaguesData["0"]) {
        return res.json({ roster: [], message: "No leagues found" });
      }
      
      const leagueArray = leaguesData["0"].league;
      if (!leagueArray || leagueArray.length === 0) {
        return res.json({ roster: [], message: "No league data found" });
      }
      
      // Get league key from the first league
      const leagueKey = leagueArray[0]?.league_key;
      console.log('League key:', leagueKey);
      
      if (!leagueKey) {
        return res.json({ roster: [], message: "No league key found" });
      }
      
      // Now get the team for this league - need to fetch teams separately
      // For now, construct team key based on user's first team in the league
      // Yahoo team keys are typically in format: {game_key}.l.{league_id}.t.{team_id}
      // We'll need to get standings to find the user's team
      const standings = await mcpClient.getLeagueStandings(leagueKey);
      console.log('Standings:', JSON.stringify(standings, null, 2));
      
      // Find user's team from standings
      const teams = standings?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;
      if (!teams) {
        return res.json({ roster: [], message: "No teams found in standings" });
      }
      
      // Get user's GUID to match with team manager
      const userGuid = users["0"].user[0]?.guid;
      console.log('User GUID:', userGuid);
      
      // Find the team that belongs to this user by matching GUID
      let teamKey = null;
      for (let i = 0; i < teams.count; i++) {
        const teamData = teams[i.toString()]?.team;
        if (teamData && Array.isArray(teamData)) {
          // teamData[0] is an array of team properties
          const teamProperties = teamData[0];
          if (Array.isArray(teamProperties)) {
            // Find team_key in the properties array
            const teamKeyObj = teamProperties.find((prop: any) => prop.team_key);
            const currentTeamKey = teamKeyObj?.team_key;
            
            // Find managers in the properties array
            const managersObj = teamProperties.find((prop: any) => prop.managers);
            const managers = managersObj?.managers;
            
            if (managers && Array.isArray(managers)) {
              const manager = managers[0]?.manager;
              if (manager?.guid === userGuid && currentTeamKey) {
                teamKey = currentTeamKey;
                console.log('Found user team:', teamKey);
                break;
              }
            }
          }
        }
      }
      
      if (!teamKey) {
        return res.json({ roster: [], message: "Could not find your team in the league" });
      }

      // Get team roster
      const rosterData = await mcpClient.getTeamRoster(teamKey);
      console.log('Roster data:', JSON.stringify(rosterData, null, 2));
      
      // Parse roster data from Yahoo's nested structure
      const playersData = rosterData?.fantasy_content?.team?.[1]?.roster?.[0]?.players;
      if (!playersData) {
        return res.json({ roster: [], message: "No roster data found" });
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

      res.json({ 
        roster, 
        leagueName: leagueArray[0]?.name || "Unknown League",
        teamKey
      });
    } catch (error: any) {
      console.error('Error fetching roster:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch roster' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
