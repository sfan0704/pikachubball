import type { Request, Response } from "express";
import { storage } from "../storage";
import {
  getAuthorizationUrl,
  exchangeCodeForToken,
  generateState,
  validateState,
} from "../yahoo-auth";
import { getAuthenticatedUserId } from "../middleware/auth";
import { decrypt, encrypt } from "../utils/encryption";
import { env } from "../config/env";
import { asyncHandler, ValidationError } from "../middleware/error-handler";
import { logger } from "../utils/logger";
import { z } from "zod";

const yahooCredentialsInputSchema = z.object({
  clientId: z.string().min(10, "Client ID must be at least 10 characters"),
  clientSecret: z.string().min(10, "Client Secret must be at least 10 characters"),
});

/**
 * Get Yahoo credentials for a user with app-level fallback
 * Priority: User-provided credentials > Environment variables
 * Returns null if no credentials available
 */
async function getYahooCredentialsWithFallback(userId: string): Promise<{ clientId: string; clientSecret: string; source: "user" | "app" } | null> {
  const userCredentials = await storage.getYahooCredentials(userId);
  
  if (userCredentials) {
    const clientId = decrypt(userCredentials.encryptedClientId);
    const clientSecret = decrypt(userCredentials.encryptedClientSecret);
    
    // Check if user credentials are valid (not fake/test)
    if (!clientId.startsWith("FAKE_") && !clientSecret.startsWith("FAKE_")) {
      return { clientId, clientSecret, source: "user" };
    }
    logger.debug("User credentials appear to be test data, checking for app-level fallback");
  }
  
  // Fall back to environment variables
  if (env.YAHOO_CLIENT_ID && env.YAHOO_CLIENT_SECRET) {
    logger.info("Using app-level Yahoo credentials from environment");
    return { clientId: env.YAHOO_CLIENT_ID, clientSecret: env.YAHOO_CLIENT_SECRET, source: "app" };
  }
  
  return null;
}

/**
 * Yahoo OAuth controller
 * Handles Yahoo OAuth flow - requires user-provided credentials (no app-level fallback)
 */
export const yahooOAuthController = {
  /**
   * Save Yahoo API credentials (required - users must provide their own)
   * If user is connected, automatically invalidates token (requires reconnection)
   */
  saveCredentials: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }

    const validatedData = yahooCredentialsInputSchema.parse(req.body);
    const encryptedClientId = encrypt(validatedData.clientId);
    const encryptedClientSecret = encrypt(validatedData.clientSecret);

    // Check if user is currently connected
    const existingToken = await storage.getYahooToken(userId);
    const wasConnected = !!existingToken;

    await storage.saveYahooCredentials({
      userId,
      encryptedClientId,
      encryptedClientSecret,
    });

    // If user was connected, invalidate token (new credentials require new token)
    if (wasConnected) {
      await storage.deleteYahooToken(userId);
      res.json({ 
        success: true, 
        message: "Yahoo credentials updated. Please reconnect your account.",
        requiresReconnection: true
      });
    } else {
      res.json({ success: true, message: "Yahoo credentials saved successfully" });
    }
  }),

  /**
   * Get Yahoo credentials status
   */
  getCredentials: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }

    const credentials = await storage.getYahooCredentials(userId);
    res.json({
      hasCredentials: !!credentials,
      updatedAt: credentials?.updatedAt || null,
    });
  }),

  /**
   * Delete Yahoo credentials (user must disconnect OAuth first)
   */
  deleteCredentials: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }

    // Check if user is connected - must disconnect first
    const token = await storage.getYahooToken(userId);
    if (token) {
      throw new ValidationError("Please disconnect your Yahoo account before removing credentials");
    }

    await storage.deleteYahooCredentials(userId);
    res.json({ success: true, message: "Credentials removed successfully" });
  }),

  /**
   * Generate Yahoo OAuth authorization URL
   * Uses user-provided credentials with app-level fallback
   */
  getAuthUrl: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }

    // Get credentials with fallback to environment variables
    const credentials = await getYahooCredentialsWithFallback(userId);
    if (!credentials) {
      throw new ValidationError(
        "Yahoo credentials are required. Please add your Client ID and Client Secret in Settings, or contact admin to configure app-level credentials."
      );
    }

    const state = generateState();
    const authUrl = getAuthorizationUrl(state, credentials.clientId);

    // Log redirect URI for debugging
    const redirectUri = env.YAHOO_REDIRECT_URI || 
      (env.REPLIT_DEV_DOMAIN 
        ? `https://${env.REPLIT_DEV_DOMAIN}/api/auth/yahoo/callback`
        : `https://localhost:${env.PORT}/api/auth/yahoo/callback`);
    
    logger.info("Generating OAuth URL", {
      userId,
      redirectUri,
      credentialSource: credentials.source,
      clientIdPrefix: credentials.clientId.substring(0, 10) + '...',
      note: "Verify the Client ID matches your Yahoo Developer Portal exactly",
    });

    res.json({ authUrl, redirectUri, credentialSource: credentials.source });
  }),

  /**
   * Handle Yahoo OAuth callback
   */
  handleCallback: asyncHandler(async (req: Request, res: Response) => {
    // Log all query parameters for debugging
    logger.info("Yahoo OAuth callback received", {
      query: req.query,
      url: req.url,
      headers: {
        referer: req.headers.referer,
        host: req.headers.host,
      },
    });

    const { code, state, error, error_description, error_uri } = req.query;

    if (error) {
      const errorStr = typeof error === 'string' ? error : String(error);
      const errorDescStr = error_description && typeof error_description === 'string' 
        ? error_description 
        : error_description 
          ? String(error_description) 
          : undefined;
      
      logger.error("Yahoo OAuth error in callback:", {
        error: errorStr,
        error_description: errorDescStr,
        error_uri,
        fullQuery: req.query,
      });
      // Redirect with error (OAuth callbacks must redirect, not return JSON)
      return res.redirect(`/?error=yahoo_oauth_error&details=${encodeURIComponent(errorStr)}${errorDescStr ? `&description=${encodeURIComponent(errorDescStr)}` : ""}`);
    }

    if (!code || typeof code !== "string") {
      logger.error("Missing authorization code in callback", {
        query: req.query,
      });
      return res.redirect("/?error=missing_code");
    }

    if (!state || typeof state !== "string" || !validateState(state)) {
      logger.error("Invalid or missing OAuth state parameter", {
        state,
        query: req.query,
      });
      return res.redirect("/?error=invalid_state");
    }

    if (!req.isAuthenticated()) {
      logger.error("User not authenticated during OAuth callback");
      return res.redirect("/?error=not_authenticated");
    }

    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.redirect("/?error=not_authenticated");
    }

    // Get credentials with fallback to environment variables
    const credentials = await getYahooCredentialsWithFallback(userId);
    if (!credentials) {
      logger.error("No Yahoo credentials found for user:", userId);
      return res.redirect("/?error=credentials_required");
    }

    logger.info("Exchanging code for token...", {
      userId,
      credentialSource: credentials.source,
      codeLength: typeof code === 'string' ? code.length : 0,
      redirectUri: env.YAHOO_REDIRECT_URI || env.REPLIT_DEV_DOMAIN || "default",
    });

    try {
      const tokens = await exchangeCodeForToken(code, credentials.clientId, credentials.clientSecret);
      const expiresAt = Math.floor(Date.now() / 1000) + tokens.expiresIn;

      await storage.saveYahooToken({
        userId: userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: expiresAt,
      });

      logger.info("Yahoo OAuth successful for user:", userId);
      res.redirect("/?yahoo_connected=true");
    } catch (error: any) {
      logger.error("Failed to exchange code for token:", {
        error: error.message,
        stack: error.stack,
        userId,
        yahooError: error.response?.data,
      });
      // Redirect with error details (OAuth callbacks must redirect)
      const errorMsg = error.response?.data?.error_description 
        || error.response?.data?.error
        || error.message
        || "Failed to exchange authorization code for token";
      return res.redirect(`/?error=token_exchange_failed&details=${encodeURIComponent(errorMsg)}`);
    }
  }),

  /**
   * Get Yahoo OAuth connection status
   */
  getStatus: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }

    const token = await storage.getYahooToken(userId);
    const credentials = await storage.getYahooCredentials(userId);

    res.json({
      connected: !!token,
      hasValidToken: token ? token.expiresAt > Math.floor(Date.now() / 1000) : false,
      hasCredentials: !!credentials,
    });
  }),

  /**
   * Disconnect Yahoo account
   * Note: Credentials remain - user can reconnect using same credentials
   */
  disconnect: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }

    await storage.deleteYahooToken(userId);
    res.json({ success: true, message: "Yahoo account disconnected. You can reconnect anytime." });
  }),
};

