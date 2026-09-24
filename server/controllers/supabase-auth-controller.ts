import type { Request, Response } from "express";
import type { Provider, SupabaseClient } from "@supabase/supabase-js";
import { asyncHandler, UnauthorizedError, ValidationError } from "../middleware/error-handler";
import {
  applyAuthNoStore,
  createSupabaseRequestClient,
  projectYahooIdentity,
  readHostedAuthConfig,
  requireYahooProviderTokens,
  YAHOO_PROVIDER,
} from "../auth/supabase-auth";
import { createSupabaseOwnerStorage } from "../storage/supabase-owner-storage";
import type { OwnerScopedStorage } from "../storage/yahoo-token-storage";

// Yahoo access tokens last one hour; the Supabase session does not report
// the provider token's own expiry.
const YAHOO_ACCESS_TOKEN_SECONDS = 3600;

export interface AuthControllerDependencies {
  createClient(req: Request, res: Response): SupabaseClient;
  createStorage(
    client: SupabaseClient,
    ownerId: string,
  ): Pick<OwnerScopedStorage, "saveYahooConnection">;
  now(): number;
}

const defaultDependencies: AuthControllerDependencies = {
  createClient: createSupabaseRequestClient,
  createStorage: createSupabaseOwnerStorage,
  now: Date.now,
};

export function createSupabaseAuthController(
  dependencies: AuthControllerDependencies = defaultDependencies,
) {
  return {
    beginYahooLogin: asyncHandler(async (req: Request, res: Response) => {
      applyAuthNoStore(res);
      const config = readHostedAuthConfig();
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

      // One Yahoo sign-in covers Fantasy access: the provider's scopes include
      // fspt-r, and Supabase hands its Yahoo tokens to this callback once.
      let identity;
      let tokens;
      try {
        identity = projectYahooIdentity(data.session.user);
        tokens = requireYahooProviderTokens(data.session);
      } catch {
        throw new UnauthorizedError("Yahoo authentication response was incomplete");
      }
      await dependencies.createStorage(client, identity.userId).saveYahooConnection({
        userId: identity.userId,
        yahooGuid: identity.yahooGuid,
        displayName: identity.displayName,
        email: identity.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Math.floor(dependencies.now() / 1000) + YAHOO_ACCESS_TOKEN_SECONDS,
      });

      res.redirect(303, "/?yahoo_connected=true");
    }),

    getCurrentUser: asyncHandler(async (req: Request, res: Response) => {
      applyAuthNoStore(res);
      const identity = req.authIdentity;
      if (!identity) {
        throw new UnauthorizedError("Not authenticated");
      }
      res.json({
        user: {
          id: identity.userId,
          username: identity.yahooGuid,
          displayName: identity.displayName,
          email: identity.email,
        },
      });
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

export const supabaseAuthController = createSupabaseAuthController();
