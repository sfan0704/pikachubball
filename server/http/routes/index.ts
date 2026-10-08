import type { Express } from "express";
import { createRequireAuth } from "../middleware/auth";
import { createRateLimiters } from "../middleware/rate-limiter";
import { createSupabaseAuthController } from "../controllers/supabase-auth-controller";
import { createYahooOAuthController } from "../controllers/yahoo-oauth-controller";
import { createAccountController } from "../controllers/account-controller";
import { createLeagueController } from "../controllers/league-controller";
import type { ServerDependencies } from "../dependencies";
import { registerAuthRoutes } from "./auth";
import { registerYahooOAuthRoutes } from "./yahoo-oauth";
import { registerLeagueRoutes } from "./leagues";
import { registerMeRoutes } from "./me";

/** Register all application routes, building each controller from the dependencies. */
export function registerRoutes(app: Express, dependencies: ServerDependencies): void {
  const { config, createSupabaseClient } = dependencies;
  const requireAuth = createRequireAuth(dependencies);
  const {
    auth: authLimiter,
    data: dataLimiter,
    leagueRefresh: leagueRefreshLimiter,
  } = createRateLimiters({
    skip: config.nodeEnv === "development",
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "pikachubball", commit: config.buildId });
  });

  registerAuthRoutes(app, {
    authLimiter,
    controller: createSupabaseAuthController({
      auth: config.auth,
      createClient: createSupabaseClient,
    }),
  });
  registerYahooOAuthRoutes(app, {
    requireAuth,
    skipRateLimit: config.nodeEnv === "development",
    controller: createYahooOAuthController({ config }),
  });
  registerMeRoutes(app, {
    requireAuth,
    controller: createAccountController(dependencies),
  });
  registerLeagueRoutes(app, {
    requireAuth,
    dataLimiter,
    leagueRefreshLimiter,
    controller: createLeagueController(dependencies),
  });
}
