import type { Express } from "express";
import { createRequireAuth } from "../middleware/auth";
import { createRateLimiters } from "../middleware/rate-limiter";
import { createSupabaseAuthController } from "../controllers/supabase-auth-controller";
import { createAccountController } from "../controllers/account-controller";
import { createLeagueController } from "../controllers/league-controller";
import type { ServerDependencies } from "../dependencies";
import { registerAuthRoutes } from "./auth";
import { registerDevRoutes } from "./dev";
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
    skip: config.nodeEnv === "development" || config.localStack,
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "pikachubball", commit: config.buildId });
  });

  registerAuthRoutes(app, {
    authLimiter,
    controller: createSupabaseAuthController({
      ...dependencies,
      auth: config.auth,
      createClient: createSupabaseClient,
    }),
  });
  registerDevRoutes(app, dependencies);
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
