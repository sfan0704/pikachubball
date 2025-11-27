import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { 
  getAuthorizationUrl, 
  exchangeCodeForToken,
  generateState,
  validateState,
  getValidAccessToken
} from "../yahoo-auth";
import { requireAuth, getAuthenticatedUserId } from "../auth-routes";
import { decrypt, encrypt } from "../encryption";
import { z } from "zod";

const yahooCredentialsInputSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
});

/** Register Yahoo OAuth and credentials routes */
export function registerAuthRoutes(app: Express): void {
  // POST: Save Yahoo credentials
  app.post("/api/settings/yahoo-credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const validatedData = yahooCredentialsInputSchema.parse(req.body);
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

  // GET: Check if Yahoo credentials exist
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

  // DELETE: Remove Yahoo credentials and tokens
  app.delete("/api/settings/yahoo-credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      await storage.deleteYahooCredentials(userId);
      await storage.deleteYahooToken(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete Yahoo credentials:", error);
      res.status(500).json({ error: "Failed to delete credentials" });
    }
  });

  // GET: Generate Yahoo OAuth URL
  app.get("/api/auth/yahoo", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const credentials = await storage.getYahooCredentials(userId);
      if (!credentials) {
        return res.status(400).json({ 
          error: "Yahoo credentials not configured. Please add your Yahoo Client ID and Secret in Settings first." 
        });
      }

      const state = generateState();
      const clientId = decrypt(credentials.encryptedClientId);
      const authUrl = getAuthorizationUrl(state, clientId);
      
      res.json({ authUrl });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
  });

  // GET: Yahoo OAuth callback handler
  app.get("/api/auth/yahoo/callback", async (req: Request, res: Response) => {
    const { code, state, error } = req.query;
    
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
      if (!req.isAuthenticated()) {
        console.error('User not authenticated during OAuth callback');
        return res.redirect('/?error=not_authenticated');
      }

      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        console.error('Could not get authenticated user ID');
        return res.redirect('/?error=not_authenticated');
      }

      const credentials = await storage.getYahooCredentials(userId);
      if (!credentials) {
        console.error('No Yahoo credentials found for user:', userId);
        return res.redirect('/?error=credentials_not_found');
      }

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

  // GET: Check Yahoo OAuth connection status
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

  // DELETE: Disconnect Yahoo account
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
}
