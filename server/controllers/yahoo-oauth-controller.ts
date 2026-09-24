import type { Request, Response } from "express";
import { env } from "../config/env";
import { getAuthenticatedUserId } from "../middleware/auth";
import { asyncHandler, ValidationError } from "../middleware/error-handler";
import { logger } from "../utils/logger";
import { revokeYahooToken } from "../yahoo-auth";

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

    if (!req.ownerStorage) {
      throw new ValidationError("Owner-scoped storage is unavailable");
    }
    const token = await req.ownerStorage.getYahooToken(userId);

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

    if (!req.ownerStorage) {
      throw new ValidationError("Owner-scoped storage is unavailable");
    }
    // Revoke at Yahoo first while the refresh token is still readable, then
    // delete locally no matter what Yahoo answered, and report both outcomes.
    let revokedAtYahoo = false;
    try {
      const token = await req.ownerStorage.getYahooToken(userId);
      if (token) {
        revokedAtYahoo = await revokeYahooToken(
          token.refreshToken,
          env.YAHOO_CLIENT_ID?.trim() ?? "",
          env.YAHOO_CLIENT_SECRET?.trim() ?? "",
        );
      }
    } catch (error) {
      logger.warn("Could not read Yahoo tokens for revocation", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    await req.ownerStorage.deleteYahooToken(userId);
    res.json({
      success: true,
      revokedAtYahoo,
      message: revokedAtYahoo
        ? "Yahoo account disconnected and access revoked at Yahoo."
        : "Yahoo tokens were deleted from Pikachu Basketball, but Yahoo did not confirm revocation. To be sure, remove the app from your Yahoo account's connected apps.",
    });
  }),
};
