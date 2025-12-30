import type { Express } from "express";
import { requireAuth } from "../middleware/auth";
import { storage } from "../storage";
import { getAuthenticatedUserId } from "../middleware/auth";
import { asyncHandler } from "../middleware/error-handler";
import { env } from "../config/env";

/**
 * Debug routes for troubleshooting OAuth issues
 * Only available in development
 */
export function registerDebugRoutes(app: Express): void {
  if (env.NODE_ENV !== "development") {
    return; // Only enable in development
  }

  // Get recent OAuth callback attempts
  app.get(
    "/api/debug/yahoo-oauth-status",
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const token = await storage.getYahooToken(userId);

      // Calculate redirect URI (same logic as yahoo-auth.ts)
      const redirectUri = env.YAHOO_REDIRECT_URI || 
        (env.REPLIT_DEV_DOMAIN 
          ? `https://${env.REPLIT_DEV_DOMAIN}/api/auth/yahoo/callback`
          : `https://localhost:${env.PORT}/api/auth/yahoo/callback`);

      res.json({
        hasToken: !!token,
        tokenExpiresAt: token?.expiresAt 
          ? new Date(token.expiresAt * 1000).toISOString()
          : null,
        tokenExpired: token 
          ? token.expiresAt < Math.floor(Date.now() / 1000)
          : null,
        redirectUri,
        redirectUriConfigured: !!env.YAHOO_REDIRECT_URI,
        port: env.PORT,
        note: "Make sure the redirect URI above matches exactly what's configured in your Yahoo Developer Portal.",
      });
    })
  );
}
