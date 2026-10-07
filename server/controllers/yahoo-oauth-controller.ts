import type { Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse, serialize } from "cookie";
import type { AppConfig } from "../config/config";
import { getRequestContext } from "../request-context";
import { asyncHandler } from "../middleware/error-handler";
import { UnauthorizedError, ValidationError } from "../../shared/api/errors";
import { applyAuthNoStore } from "../auth/supabase-auth";
import { exchangeAuthorizationCode, revokeYahooToken } from "../yahoo-auth";

const FANTASY_OAUTH_STATE_COOKIE = "pikachubball-yahoo-state";

function stateMatches(expected: string | undefined, received: unknown): boolean {
  if (!expected || typeof received !== "string") return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Yahoo OAuth controller
 * Handles Yahoo OAuth status and disconnection
 * Note: Main login flow is handled by yahoo-social-controller.ts
 */
export interface YahooOAuthControllerDependencies {
  readonly config: AppConfig;
}

export function createYahooOAuthController({
  config: appConfig,
}: YahooOAuthControllerDependencies) {
  const fantasyOAuthConfig = () => {
    const { clientId, clientSecret, providerRedirectUri: redirectUri } = appConfig.yahoo;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Yahoo Fantasy OAuth configuration is incomplete");
    }
    const redirect = new URL(redirectUri);
    if (redirect.protocol !== "https:" || redirect.origin !== appConfig.auth.appOrigin) {
      throw new Error("Yahoo Fantasy callback must use the application origin");
    }
    return { clientId, clientSecret, redirectUri };
  };

  const stateCookie = (value: string, maxAge: number): string =>
    serialize(FANTASY_OAUTH_STATE_COOKIE, value, {
      httpOnly: true,
      secure: appConfig.nodeEnv === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });

  return {
    beginFantasyAccess: asyncHandler(async (_req: Request, res: Response) => {
      applyAuthNoStore(res);
      const config = fantasyOAuthConfig();
      const state = randomBytes(32).toString("base64url");
      res.append("Set-Cookie", stateCookie(state, 600));

      const authorizationUrl = new URL("https://api.login.yahoo.com/oauth2/request_auth");
      authorizationUrl.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        state,
        prompt: "consent",
      }).toString();
      res.redirect(302, authorizationUrl.toString());
    }),

    completeFantasyAccess: asyncHandler(async (req: Request, res: Response) => {
      applyAuthNoStore(res);
      const { user: identity, storage, clock } = getRequestContext(req);
      const cookies = parse(req.headers.cookie ?? "");
      if (!stateMatches(cookies[FANTASY_OAUTH_STATE_COOKIE], req.query.state)) {
        throw new ValidationError("Invalid Yahoo authorization state");
      }
      const code = req.query.code;
      if (typeof code !== "string" || !code.trim()) {
        throw new ValidationError("Missing Yahoo authorization code");
      }

      const config = fantasyOAuthConfig();
      const tokens = await exchangeAuthorizationCode(
        code,
        config.clientId,
        config.clientSecret,
        config.redirectUri
      );
      if (tokens.yahooGuid && tokens.yahooGuid !== identity.yahooGuid) {
        throw new UnauthorizedError("Yahoo Fantasy account does not match the signed-in account");
      }
      await storage.saveYahooConnection({
        userId: identity.userId,
        yahooGuid: identity.yahooGuid,
        displayName: identity.displayName,
        email: identity.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Math.floor(clock.now() / 1000) + tokens.expiresIn,
      });
      res.append("Set-Cookie", stateCookie("", 0));
      res.redirect(303, "/?yahoo_connected=true");
    }),

    /**
     * Get Yahoo OAuth connection status
     */
    getStatus: asyncHandler(async (req: Request, res: Response) => {
      const { user, storage, clock } = getRequestContext(req);
      const token = await storage.getYahooToken(user.userId);

      res.json({
        connected: !!token,
        hasValidToken: token ? token.expiresAt > Math.floor(clock.now() / 1000) : false,
      });
    }),

    /**
     * Disconnect Yahoo account
     */
    disconnect: asyncHandler(async (req: Request, res: Response) => {
      const { user, storage, logger } = getRequestContext(req);
      const userId = user.userId;
      // Revoke at Yahoo first while the refresh token is still readable, then
      // delete locally no matter what Yahoo answered, and report both outcomes.
      let revokedAtYahoo = false;
      try {
        const token = await storage.getYahooToken(userId);
        if (token) {
          revokedAtYahoo = await revokeYahooToken(
            token.refreshToken,
            appConfig.yahoo.clientId ?? "",
            appConfig.yahoo.clientSecret ?? ""
          );
        }
      } catch (error) {
        logger.warn("Could not read Yahoo tokens for revocation", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      await storage.deleteYahooToken(userId);
      res.json({
        success: true,
        revokedAtYahoo,
        message: revokedAtYahoo
          ? "Yahoo account disconnected and access revoked at Yahoo."
          : "Yahoo tokens were deleted from Pikachu Basketball, but Yahoo did not confirm revocation. To be sure, remove the app from your Yahoo account's connected apps.",
      });
    }),
  };
}
