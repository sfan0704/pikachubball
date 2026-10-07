import type { Express } from "express";
import { createRequireAuth } from "../middleware/auth";
import { createRateLimiters } from "../middleware/rate-limiter";
import { createSupabaseAuthController } from "../controllers/supabase-auth-controller";
import { createYahooController } from "../controllers/yahoo-controller";
import { createYahooOAuthController } from "../controllers/yahoo-oauth-controller";
import { createVizController } from "../controllers/viz-controller";
import type { ServerDependencies } from "../dependencies";
import { registerAuthRoutes } from "./auth";
import { registerYahooOAuthRoutes } from "./yahoo-oauth";
import { registerYahooRoutes } from "./yahoo";
import { registerVizRoutes } from "./viz";

/** Register all application routes, building each controller from the dependencies. */
export function registerRoutes(app: Express, dependencies: ServerDependencies): void {
  const { config, logger, createSupabaseClient, createYahooClient } = dependencies;
  const requireAuth = createRequireAuth(dependencies);
  const { auth: authLimiter } = createRateLimiters({ skip: config.nodeEnv === "development" });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "pikachubball" });
  });

  registerAuthRoutes(app, {
    requireAuth,
    authLimiter,
    controller: createSupabaseAuthController({
      auth: config.auth,
      createClient: createSupabaseClient,
    }),
  });
  registerYahooOAuthRoutes(app, {
    requireAuth,
    controller: createYahooOAuthController({ config, logger }),
  });
  registerYahooRoutes(app, {
    requireAuth,
    controller: createYahooController({ logger, createYahooClient }),
    createYahooClient,
  });
  registerVizRoutes(app, {
    requireAuth,
    controller: createVizController({ createYahooClient }),
  });
}
