import type { Express } from "express";
import { registerAuthRoutes } from "./auth";
import { registerYahooOAuthRoutes } from "./yahoo-oauth";
import { registerYahooRoutes } from "./yahoo";
import { registerVizRoutes } from "./viz";

/** Register all application routes */
export function registerRoutes(app: Express): void {
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "pikachubball" });
  });

  registerAuthRoutes(app);

  registerYahooOAuthRoutes(app);
  registerYahooRoutes(app);
  registerVizRoutes(app);
}
