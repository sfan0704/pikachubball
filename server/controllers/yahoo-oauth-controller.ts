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
   * Requires user-provided credentials
   */
  getAuthUrl: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }

    // Require user-provided credentials
    const credentials = await storage.getYahooCredentials(userId);
    if (!credentials) {
      throw new ValidationError(
        "Yahoo credentials are required. Please add your Client ID and Client Secret in Settings."
      );
    }

    const clientId = decrypt(credentials.encryptedClientId);

    const state = generateState();
    const authUrl = getAuthorizationUrl(state, clientId);

    // Log redirect URI for debugging
    const redirectUri = env.YAHOO_REDIRECT_URI || 
      (env.REPLIT_DEV_DOMAIN 
        ? `https://${env.REPLIT_DEV_DOMAIN}/api/auth/yahoo/callback`
        : `https://localhost:${env.PORT}/api/auth/yahoo/callback`);
    
    logger.info("Generating OAuth URL", {
      userId,
      redirectUri,
      clientIdPrefix: clientId.substring(0, 30) + '...',
      clientIdLength: clientId.length,
      clientIdFirstChars: clientId.substring(0, 50),
      note: "Verify the Client ID matches your Yahoo Developer Portal exactly",
    });

    res.json({ authUrl, redirectUri });
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

    // Require user-provided credentials
    const credentials = await storage.getYahooCredentials(userId);
    if (!credentials) {
      logger.error("No Yahoo credentials found for user:", userId);
      return res.redirect("/?error=credentials_required");
    }

    const clientId = decrypt(credentials.encryptedClientId);
    const clientSecret = decrypt(credentials.encryptedClientSecret);

    logger.info("Exchanging code for token...", {
      userId,
      codeLength: typeof code === 'string' ? code.length : 0,
      redirectUri: env.YAHOO_REDIRECT_URI || env.REPLIT_DEV_DOMAIN || "default",
    });

    try {
      const tokens = await exchangeCodeForToken(code, clientId, clientSecret);
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

