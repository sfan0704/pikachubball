import type { Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse, serialize } from "cookie";
import type { AppConfig } from "../../config/config";
import { asyncHandler } from "../middleware/error-handler";
import { getRequestContext } from "../request-context";
import { AppError, UnauthorizedError, ValidationError } from "../../../shared/api/errors";
import { applyAuthNoStore } from "../auth/supabase-auth";
import { exchangeAuthorizationCode } from "../../fantasy/yahoo/yahoo-auth";
import type { FantasyDataSource } from "../../fantasy/fantasy-data-source";
import { syncLeagues } from "../../services/leagues-service";
import type { RequestContext, YahooClientProvider } from "../request-context";

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
  createFantasyDataSource(yahooClient: YahooClientProvider): FantasyDataSource;
}

function fantasyOAuthConfig(appConfig: AppConfig) {
  const { clientId, clientSecret, providerRedirectUri: redirectUri } = appConfig.yahoo;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Yahoo Fantasy OAuth configuration is incomplete");
  }
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "https:" || redirect.origin !== appConfig.auth.appOrigin) {
    throw new Error("Yahoo Fantasy callback must use the application origin");
  }
  return { clientId, clientSecret, redirectUri };
}

function stateCookie(appConfig: AppConfig, value: string, maxAge: number): string {
  return serialize(FANTASY_OAUTH_STATE_COOKIE, value, {
    httpOnly: true,
    secure: appConfig.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

function authorizationUrl(
  oauthBaseUrl: string,
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const url = new URL(`${oauthBaseUrl}/oauth2/request_auth`);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    prompt: "consent",
  }).toString();
  return url.toString();
}

/** The authorization code from the callback, after the state cookie has been checked. */
function checkedCode(req: Request): string {
  const cookies = parse(req.headers.cookie ?? "");
  if (!stateMatches(cookies[FANTASY_OAUTH_STATE_COOKIE], req.query.state)) {
    throw new ValidationError("Invalid Yahoo authorization state");
  }
  const code = req.query.code;
  if (typeof code !== "string" || !code.trim()) {
    throw new ValidationError("Missing Yahoo authorization code");
  }
  return code;
}

/**
 * Saves the user's leagues right after the connection. A failure never blocks
 * sign-in: it is logged, and `GET /api/leagues` fetches them when it finds none.
 */
async function syncLeaguesAfterConnecting(
  context: RequestContext,
  createFantasyDataSource: YahooOAuthControllerDependencies["createFantasyDataSource"]
): Promise<void> {
  try {
    await syncLeagues(context.storage, createFantasyDataSource(context.yahooClient));
  } catch (error) {
    context.logger.warn("League sync after connecting Yahoo failed; retried on first request", {
      code: error instanceof AppError ? error.code : "UNEXPECTED",
    });
  }
}

export function createYahooOAuthController({
  config: appConfig,
  createFantasyDataSource,
}: YahooOAuthControllerDependencies) {
  return {
    beginFantasyAccess: asyncHandler(async (_req: Request, res: Response) => {
      applyAuthNoStore(res);
      const config = fantasyOAuthConfig(appConfig);
      const state = randomBytes(32).toString("base64url");
      res.append("Set-Cookie", stateCookie(appConfig, state, 600));
      res.redirect(
        302,
        authorizationUrl(appConfig.yahoo.oauthBaseUrl, config.clientId, config.redirectUri, state)
      );
    }),

    completeFantasyAccess: asyncHandler(async (req: Request, res: Response) => {
      applyAuthNoStore(res);
      const context = getRequestContext(req);
      const { user: identity, storage, clock } = context;
      const code = checkedCode(req);

      const config = fantasyOAuthConfig(appConfig);
      const tokens = await exchangeAuthorizationCode(
        code,
        config.clientId,
        config.clientSecret,
        config.redirectUri,
        fetch,
        appConfig.yahoo.oauthBaseUrl
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
      await syncLeaguesAfterConnecting(context, createFantasyDataSource);
      res.append("Set-Cookie", stateCookie(appConfig, "", 0));
      res.redirect(303, "/?yahoo_connected=true");
    }),
  };
}
