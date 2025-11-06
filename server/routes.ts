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

  // Yahoo Fantasy API Routes
  app.get("/api/yahoo/games", async (req: Request, res: Response) => {
    try {
      const userId = 'default-user';
      const data = await makeYahooApiRequest(userId, '/users;use_login=1/games');
      res.json(data);
    } catch (error) {
      if (error instanceof YahooAuthError && error.needsReauth) {
        return res.status(401).json({ error: error.message, needsReauth: true });
      }
      res.status(500).json({ error: 'Failed to fetch games data' });
    }
  });

  app.get("/api/yahoo/leagues", async (req: Request, res: Response) => {
    try {
      const userId = 'default-user';
      const data = await makeYahooApiRequest(userId, '/users;use_login=1/games;game_keys=nba/leagues');
      res.json(data);
    } catch (error) {
      if (error instanceof YahooAuthError && error.needsReauth) {
        return res.status(401).json({ error: error.message, needsReauth: true });
      }
      res.status(500).json({ error: 'Failed to fetch leagues data' });
    }
  });

  app.get("/api/yahoo/team/:teamKey", async (req: Request, res: Response) => {
    try {
      const userId = 'default-user';
      const { teamKey } = req.params;
      const data = await makeYahooApiRequest(userId, `/team/${teamKey}`);
      res.json(data);
    } catch (error) {
      if (error instanceof YahooAuthError && error.needsReauth) {
        return res.status(401).json({ error: error.message, needsReauth: true });
      }
      res.status(500).json({ error: 'Failed to fetch team data' });
    }
  });

  app.get("/api/yahoo/roster/:teamKey", async (req: Request, res: Response) => {
    try {
      const userId = 'default-user';
      const { teamKey } = req.params;
      const data = await makeYahooApiRequest(userId, `/team/${teamKey}/roster`);
      res.json(data);
    } catch (error) {
      if (error instanceof YahooAuthError && error.needsReauth) {
        return res.status(401).json({ error: error.message, needsReauth: true });
      }
      res.status(500).json({ error: 'Failed to fetch roster data' });
    }
  });

  // Get user's roster via MCP
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
      const leagues = await mcpClient.getUserLeagues();
      
      if (!leagues || leagues.length === 0) {
        return res.json({ roster: [], message: "No leagues found" });
      }

      // Get the first team from the first league
      const firstLeague = leagues[0];
      const teamKey = firstLeague.teams?.[0]?.team_key;
      
      if (!teamKey) {
        return res.json({ roster: [], message: "No team found in league" });
      }

      // Get team roster
      const rosterData = await mcpClient.getTeamRoster(teamKey);
      
      // Transform roster data to match frontend format
      const roster = rosterData.players?.map((player: any) => ({
        name: player.name?.full || "Unknown Player",
        position: player.display_position || player.primary_position || "N/A",
        team: player.editorial_team_abbr || "N/A",
        status: player.status === "Healthy" || player.status === "" ? "active" : 
                player.status === "IL" || player.status === "IL+" ? "injured" :
                player.status === "O" || player.status === "GTD" ? "out" : "active",
        playerKey: player.player_key,
      })) || [];

      res.json({ roster, leagueName: firstLeague.name, teamName: firstLeague.teams?.[0]?.name });
    } catch (error: any) {
      console.error('Error fetching roster:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch roster' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
