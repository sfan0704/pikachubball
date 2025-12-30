import type { Request, Response } from "express";
import { storage } from "../storage";
import { getAuthenticatedUserId } from "../middleware/auth";
import { asyncHandler, ValidationError } from "../middleware/error-handler";

/**
 * Yahoo OAuth controller
 * Handles Yahoo OAuth status and disconnection
 * Note: Main login flow is handled by yahoo-social-controller.ts
 */
export const yahooOAuthController = {
  /**
   * Get Yahoo OAuth connection status
   */
  getStatus: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }

    const token = await storage.getYahooToken(userId);

    res.json({
      connected: !!token,
      hasValidToken: token ? token.expiresAt > Math.floor(Date.now() / 1000) : false,
    });
  }),

  /**
   * Disconnect Yahoo account
   */
  disconnect: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      throw new ValidationError("Authentication required");
    }

    await storage.deleteYahooToken(userId);
    res.json({ success: true, message: "Yahoo account disconnected." });
  }),
};
