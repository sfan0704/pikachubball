import type { Request, Response } from "express";
import type { Provider, Session, SupabaseClient } from "@supabase/supabase-js";
import { asyncHandler } from "../middleware/error-handler";
import { AppError, UnauthorizedError, ValidationError } from "../../../shared/api/errors";
import type { HostedAuthConfig } from "../../config/config";
import {
  applyAuthNoStore,
  projectYahooIdentity,
  requireYahooProviderTokens,
  YAHOO_PROVIDER,
} from "../auth/supabase-auth";
import type { ServerDependencies } from "../dependencies";
import { createRequestContext, type RequestContext } from "../request-context";
import { syncLeagues } from "../../services/leagues-service";

// Yahoo access tokens last one hour; the Supabase session doesn't report the
// provider token's own expiry.
const YAHOO_ACCESS_TOKEN_SECONDS = 3600;

/** What the sign-in controller needs from the composition root. */
export interface AuthControllerDependencies extends Pick<
  ServerDependencies,
  "clock" | "createOwnerStorage" | "createYahooClient" | "createFantasyDataSource"
> {
  readonly auth: HostedAuthConfig;
  createClient(req: Request, res: Response): SupabaseClient;
}

/**
 * Saves the user's leagues right after sign-in. A failure never blocks
 * sign-in: it is logged, and `GET /api/leagues` fetches them when it finds none.
 */
async function syncLeaguesAfterSignIn(
  context: RequestContext,
  createFantasyDataSource: AuthControllerDependencies["createFantasyDataSource"]
): Promise<void> {
  try {
    await syncLeagues(context.storage, createFantasyDataSource(context.yahooClient));
  } catch (error) {
    context.logger.warn("League sync at sign-in failed; retried on first request", {
      code: error instanceof AppError ? error.code : "UNEXPECTED",
    });
  }
}

/**
 * One Yahoo sign-in covers Fantasy access: the provider's scopes include
 * fspt-r, and Supabase hands its Yahoo tokens to the callback once. They are
 * stored for the signed-in user, then the user's leagues are synced.
 */
async function connectYahoo(
  req: Request,
  client: SupabaseClient,
  session: Session,
  dependencies: AuthControllerDependencies
): Promise<void> {
  let identity;
  let tokens;
  try {
    identity = projectYahooIdentity(session.user);
    tokens = requireYahooProviderTokens(session);
  } catch {
    throw new UnauthorizedError("Yahoo authentication response was incomplete");
  }

  const { clock } = dependencies;
  const storage = dependencies.createOwnerStorage(client, identity.userId);
  await storage.saveYahooConnection({
    ...identity,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Math.floor(clock.now() / 1000) + YAHOO_ACCESS_TOKEN_SECONDS,
  });
  if (!req.scope) {
    throw new Error("The request scope middleware must run before sign-in");
  }
  const context = createRequestContext({
    scope: req.scope,
    user: identity,
    storage,
    clock,
    createYahooClient: dependencies.createYahooClient,
  });
  await syncLeaguesAfterSignIn(context, dependencies.createFantasyDataSource);
}

export function createSupabaseAuthController(dependencies: AuthControllerDependencies) {
  return {
    beginYahooLogin: asyncHandler(async (req: Request, res: Response) => {
      applyAuthNoStore(res);
      const config = dependencies.auth;
      const client = dependencies.createClient(req, res);
      const { data, error } = await client.auth.signInWithOAuth({
        provider: YAHOO_PROVIDER as Provider,
        options: {
          redirectTo: `${config.appOrigin}/api/auth/callback`,
          skipBrowserRedirect: true,
          scopes: "openid profile email fspt-r",
          queryParams: {
            prompt: "consent",
          },
        },
      });
      if (error || !data.url) {
        throw new ValidationError("Unable to start Yahoo authentication");
      }

      const redirect = new URL(data.url);
      if (redirect.protocol !== "https:" || redirect.origin !== config.supabaseUrl) {
        throw new ValidationError("Authentication redirect is invalid");
      }
      res.redirect(302, redirect.toString());
    }),

    completeYahooLogin: asyncHandler(async (req: Request, res: Response) => {
      applyAuthNoStore(res);
      const code = req.query.code;
      if (typeof code !== "string" || !code.trim()) {
        throw new ValidationError("Missing authorization code");
      }

      const client = dependencies.createClient(req, res);
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error || !data.session) {
        throw new UnauthorizedError("Yahoo authentication callback was rejected");
      }

      await connectYahoo(req, client, data.session, dependencies);
      res.redirect(303, "/?yahoo_connected=true");
    }),

    logout: asyncHandler(async (req: Request, res: Response) => {
      applyAuthNoStore(res);
      const client = dependencies.createClient(req, res);
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) {
        throw new UnauthorizedError("Unable to end the current session");
      }
      res.json({ success: true });
    }),
  };
}
