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
import OpenAI from "openai";
import { YahooMCPDataSource } from "./services/fantasy-data-source.js";
import { getLeagueRankings, getLeagueHeatmap } from "./services/viz/league-viz.js";
import { getMatchupComparison } from "./services/viz/matchup-viz.js";
import { getScheduleMatrix } from "./services/viz/schedule-viz.js";

// Yahoo credentials schema for user input
const yahooCredentialsInputSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
});

// OpenAI credentials schema for user input
const openaiCredentialsInputSchema = z.object({
  apiKey: z.string().min(1, "OpenAI API key is required"),
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

  // OpenAI Credentials Management Routes (Protected)
  app.post("/api/settings/openai-credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const validatedData = openaiCredentialsInputSchema.parse(req.body);

      // Encrypt API key before storing
      const encryptedApiKey = encrypt(validatedData.apiKey);

      await storage.saveOpenaiCredentials({
        userId,
        encryptedApiKey,
      });

      res.json({ success: true, message: "OpenAI API key saved successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Failed to save OpenAI credentials:", error);
      res.status(500).json({ error: "Failed to save API key" });
    }
  });

  app.get("/api/settings/openai-credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const credentials = await storage.getOpenaiCredentials(userId);
      
      res.json({ 
        hasCredentials: !!credentials,
        updatedAt: credentials?.updatedAt || null,
      });
    } catch (error) {
      console.error("Failed to check OpenAI credentials:", error);
      res.status(500).json({ error: "Failed to check credentials" });
    }
  });

  app.delete("/api/settings/openai-credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      await storage.deleteOpenaiCredentials(userId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete OpenAI credentials:", error);
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
      try {
        await mcpClient.setCredentials(accessToken, token.refreshToken, token.expiresAt);
      } catch (credError: any) {
        console.error('Failed to set MCP credentials:', credError);
        return res.status(400).json({ error: "Yahoo Fantasy credentials not properly configured. Please reconnect your Yahoo account." });
      }

      // Get user's leagues
      let leaguesResponse;
      try {
        leaguesResponse = await mcpClient.getUserLeagues();
      } catch (leagueError: any) {
        console.error('Error calling getUserLeagues:', leagueError);
        // If it's a credential/auth error, return 400 instead of 500
        if (leagueError.message?.includes('credentials') || leagueError.message?.includes('refresh') || leagueError.message?.includes('token')) {
          return res.status(400).json({ error: "Yahoo Fantasy credentials expired or invalid. Please reconnect your Yahoo account." });
        }
        throw leagueError;
      }
      
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
      const weekParam = req.query.week;
      let week: number | undefined;
      
      if (!leagueKey) {
        return res.status(400).json({ error: "League key required" });
      }

      // Parse and validate week parameter
      if (weekParam) {
        const parsed = parseInt(weekParam as string, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          return res.status(400).json({ error: "Week must be a positive integer" });
        }
        week = parsed;
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

      // Use league-viz service to get rankings
      const dataSource = new YahooMCPDataSource(mcpClient);
      const response = await getLeagueRankings(dataSource, leagueKey, week);

      res.json(response);
    } catch (error: any) {
      console.error('Error fetching league rankings:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch league rankings' });
    }
  });

  // Get league heatmap visualization
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

  // Get matchup comparison visualization
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
      // Use opponentTeamKey if provided (matchup simulator), otherwise use actual opponent for the week
      const effectiveOpponentTeamKey = opponentTeamKeyParam || undefined;
      const response = await getMatchupComparison(dataSource, leagueKey, teamKey, week, effectiveOpponentTeamKey);

      res.json(response);
    } catch (error: any) {
      console.error('Error fetching matchup comparison:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch matchup comparison' });
    }
  });

  // Get games remaining schedule visualization
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

  // Chat API endpoint with Anthropic + MCP integration
  app.post("/api/chat/message", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { message, teamKey, leagueKey, conversationHistory } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      // Check if user has Yahoo connection first
      const tokenData = await storage.getYahooToken(userId);
      if (!tokenData) {
        return res.status(400).json({ 
          error: "Yahoo Fantasy not connected",
          requiresYahooConnection: true,
          message: "Please connect your Yahoo Fantasy account to use the AI assistant." 
        });
      }

      // Get valid access token (will throw if token is invalid/expired)
      let accessToken: string | null;
      try {
        accessToken = await getValidAccessToken(userId);
      } catch (error: any) {
        return res.status(400).json({ 
          error: "Yahoo Fantasy connection expired",
          requiresYahooConnection: true,
          message: "Your Yahoo Fantasy connection has expired. Please reconnect your account." 
        });
      }

      if (!accessToken) {
        return res.status(400).json({ 
          error: "Yahoo Fantasy connection invalid",
          requiresYahooConnection: true,
          message: "Could not get valid Yahoo Fantasy credentials. Please reconnect your account." 
        });
      }

      // Check if user has OpenAI credentials configured
      const openaiCreds = await storage.getOpenaiCredentials(userId);
      if (!openaiCreds) {
        return res.status(400).json({ 
          error: "OpenAI API key not configured",
          requiresOpenaiKey: true,
          message: "Please add your OpenAI API key in Settings to use the AI assistant." 
        });
      }

      // Decrypt and use user's OpenAI API key
      const userApiKey = decrypt(openaiCreds.encryptedApiKey);
      
      // Initialize OpenAI client with user's API key
      const openai = new OpenAI({
        apiKey: userApiKey,
      });

      // Get MCP client for tool access
      const mcpClient = await getMCPClient();
      
      // Set up user's Yahoo credentials in MCP server
      await mcpClient.setCredentials(
        accessToken,
        tokenData.refreshToken,
        tokenData.expiresAt
      );

      // Define MCP tools as OpenAI function calling tools
      const tools: OpenAI.ChatCompletionTool[] = [
        {
          type: "function",
          function: {
            name: "get_user_leagues",
            description: "Get all fantasy basketball leagues for the authenticated user",
            parameters: {
              type: "object",
              properties: {},
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_league_standings",
            description: "Get current standings for a specific league",
            parameters: {
              type: "object",
              properties: {
                leagueKey: { type: "string", description: "The league key (e.g., '466.l.29849')" }
              },
              required: ["leagueKey"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_team_roster",
            description: "Get the roster for a specific team",
            parameters: {
              type: "object",
              properties: {
                teamKey: { type: "string", description: "The team key (e.g., '466.l.29849.t.10')" }
              },
              required: ["teamKey"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_league_scoreboard",
            description: "Get matchups and scores for a specific week",
            parameters: {
              type: "object",
              properties: {
                leagueKey: { type: "string", description: "The league key" },
                week: { type: "number", description: "Week number (optional, defaults to current week)" }
              },
              required: ["leagueKey"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_player_stats",
            description: "Get detailed stats for specific players",
            parameters: {
              type: "object",
              properties: {
                playerKeys: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Array of player keys" 
                }
              },
              required: ["playerKeys"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_free_agents",
            description: "Search for available free agents in a league",
            parameters: {
              type: "object",
              properties: {
                leagueKey: { type: "string", description: "The league key" },
                position: { type: "string", description: "Filter by position (optional)" },
                status: { type: "string", description: "Filter by player status (optional)" },
                sort: { type: "string", description: "Sort criteria (optional)" },
                count: { type: "number", description: "Number of results (optional, default 25)" }
              },
              required: ["leagueKey"]
            }
          }
        }
      ];

      // Build system message with context
      const systemMessage = `You are an expert Fantasy Basketball AI assistant. You help users optimize their fantasy teams through intelligent analysis of Yahoo Fantasy Basketball data.

Your capabilities:
- Analyze team rosters and player stats
- Suggest start/sit decisions based on matchups and recent performance
- Recommend waiver wire pickups
- Evaluate trade opportunities
- Identify team strengths and weaknesses

Current context:
${teamKey ? `- User's team: ${teamKey}` : ''}
${leagueKey ? `- User's league: ${leagueKey}` : ''}

Provide actionable, data-driven advice. When making recommendations, explain your reasoning based on the stats and data you retrieve.`;

      // Build messages array for OpenAI
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: systemMessage
        },
        ...(conversationHistory || []),
        {
          role: "user",
          content: message
        }
      ];

      // Call OpenAI API with function calling
      let response = await openai.chat.completions.create({
        model: "gpt-5",
        max_tokens: 4096,
        tools,
        messages
      });

      // Handle function calls in a loop
      let choice = response.choices[0];
      while (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        const toolCall = choice.message.tool_calls[0];
        if (!toolCall) break;

        // Execute the MCP tool
        let toolResult: any;
        try {
          // Type guard for function tool calls
          if (toolCall.type !== "function") continue;
          
          const input = JSON.parse(toolCall.function.arguments);
          
          switch (toolCall.function.name) {
            case "get_user_leagues":
              toolResult = await mcpClient.getUserLeagues();
              break;
            case "get_league_standings":
              toolResult = await mcpClient.getLeagueStandings(input.leagueKey);
              break;
            case "get_team_roster":
              toolResult = await mcpClient.getTeamRoster(input.teamKey);
              break;
            case "get_league_scoreboard":
              toolResult = await mcpClient.getLeagueScoreboard(
                input.leagueKey,
                input.week
              );
              break;
            case "get_player_stats":
              toolResult = await mcpClient.getPlayerStats(input.playerKeys);
              break;
            case "get_free_agents":
              toolResult = await mcpClient.getFreeAgents(
                input.leagueKey,
                {
                  position: input.position,
                  status: input.status,
                  sort: input.sort,
                  count: input.count
                }
              );
              break;
            default:
              toolResult = { error: "Unknown tool" };
          }
        } catch (error: any) {
          toolResult = { error: error.message };
        }

        // Add assistant message with tool call
        messages.push(choice.message);

        // Add tool response
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });

        // Get next response
        response = await openai.chat.completions.create({
          model: "gpt-5",
          max_tokens: 4096,
          tools,
          messages
        });
        
        choice = response.choices[0];
      }

      // Extract text response
      const assistantMessage = choice.message.content || "I apologize, but I couldn't generate a response.";

      res.json({
        message: assistantMessage,
        conversationHistory: messages.slice((conversationHistory?.length || 0) + 1) // Skip system message
      });

    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ 
        error: "Failed to process chat message",
        details: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
