import type { Request, Response } from "express";
import type { Provider, SupabaseClient } from "@supabase/supabase-js";
import { asyncHandler, UnauthorizedError, ValidationError } from "../middleware/error-handler";
import {
  applyAuthNoStore,
  createSupabaseRequestClient,
  projectYahooIdentity,
  readHostedAuthConfig,
  YAHOO_PROVIDER,
} from "../auth/supabase-auth";
export interface AuthControllerDependencies {
  createClient(req: Request, res: Response): SupabaseClient;
}

const defaultDependencies: AuthControllerDependencies = {
  createClient: createSupabaseRequestClient,
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

      try {
        projectYahooIdentity(data.session.user);
      } catch {
        throw new UnauthorizedError("Yahoo authentication response was incomplete");
      }

      res.redirect(303, "/api/auth/yahoo/fantasy");
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
