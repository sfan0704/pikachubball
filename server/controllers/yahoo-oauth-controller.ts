import type { Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse, serialize } from "cookie";
import { env } from "../config/env";
import { getAuthenticatedUserId } from "../middleware/auth";
import { asyncHandler, UnauthorizedError, ValidationError } from "../middleware/error-handler";
import { applyAuthNoStore, readHostedAuthConfig } from "../auth/supabase-auth";
import { exchangeAuthorizationCode } from "../yahoo-auth";

const FANTASY_OAUTH_STATE_COOKIE = "pikachubball-yahoo-state";

function fantasyOAuthConfig() {
  const clientId = env.YAHOO_CLIENT_ID?.trim();
  const clientSecret = env.YAHOO_CLIENT_SECRET?.trim();
  const redirectUri = env.YAHOO_PROVIDER_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Yahoo Fantasy OAuth configuration is incomplete");
  }
  const redirect = new URL(redirectUri);
  const appOrigin = readHostedAuthConfig().appOrigin;
  if (redirect.protocol !== "https:" || redirect.origin !== appOrigin) {
    throw new Error("Yahoo Fantasy callback must use the application origin");
  }
  return { clientId, clientSecret, redirectUri };
}

function stateMatches(expected: string | undefined, received: unknown): boolean {
  if (!expected || typeof received !== "string") return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

function stateCookie(value: string, maxAge: number): string {
  return serialize(FANTASY_OAUTH_STATE_COOKIE, value, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

/**
 * Yahoo OAuth controller
 * Handles Yahoo OAuth status and disconnection
 * Note: Main login flow is handled by yahoo-social-controller.ts
 */
export const yahooOAuthController = {
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
      scope: "fspt-r",
      state,
      prompt: "consent",
    }).toString();
    res.redirect(302, authorizationUrl.toString());
  }),

  completeFantasyAccess: asyncHandler(async (req: Request, res: Response) => {
    applyAuthNoStore(res);
    const identity = req.authIdentity;
    if (!identity || !req.ownerStorage) {
      throw new UnauthorizedError("Authentication required");
    }
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
      config.redirectUri,
    );
    if (tokens.yahooGuid !== identity.yahooGuid) {
      throw new UnauthorizedError("Yahoo Fantasy account does not match the signed-in account");
    }
    await req.ownerStorage.saveYahooConnection({
      userId: identity.userId,
      yahooGuid: identity.yahooGuid,
      displayName: identity.displayName,
      email: identity.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expiresIn,
    });
    res.append("Set-Cookie", stateCookie("", 0));
    res.redirect(303, "/?yahoo_connected=true");
  }),

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
    await req.ownerStorage.deleteYahooToken(userId);
    res.json({ success: true, message: "Yahoo account disconnected." });
  }),
};
