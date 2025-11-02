import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  getAuthorizationUrl, 
  exchangeCodeForToken, 
  makeYahooApiRequest,
  generateState,
  validateState,
  YahooAuthError
} from "./yahoo-auth";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Yahoo OAuth Routes
  app.get("/api/auth/yahoo", async (req: Request, res: Response) => {
    try {
      const state = generateState();
      const authUrl = getAuthorizationUrl(state);
      res.json({ authUrl });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
  });

  app.get("/api/auth/yahoo/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.redirect('/?error=missing_code');
    }

    if (!state || typeof state !== 'string' || !validateState(state)) {
      console.error('Invalid or missing OAuth state parameter');
      return res.redirect('/?error=invalid_state');
    }

    try {
      const tokens = await exchangeCodeForToken(code);
      
      // For now, use a default user ID since we don't have user auth yet
      const userId = 'default-user';
      
      const expiresAt = Math.floor(Date.now() / 1000) + tokens.expiresIn;
      
      await storage.saveYahooToken({
        userId: userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: expiresAt
      });

      res.redirect('/?yahoo_connected=true');
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect('/?error=oauth_failed');
    }
  });

  app.get("/api/auth/yahoo/status", async (req: Request, res: Response) => {
    try {
      const userId = 'default-user';
      const token = await storage.getYahooToken(userId);
      
      res.json({ 
        connected: !!token,
        hasValidToken: token ? token.expiresAt > Math.floor(Date.now() / 1000) : false
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check connection status' });
    }
  });

  app.delete("/api/auth/yahoo", async (req: Request, res: Response) => {
    try {
      const userId = 'default-user';
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

  const httpServer = createServer(app);
  return httpServer;
}
