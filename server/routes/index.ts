import type { Express } from "express";
import { registerAuthRoutes } from "./auth";
import { registerYahooOAuthRoutes } from "./yahoo-oauth";
import { registerYahooRoutes } from "./yahoo";
import { registerVizRoutes } from "./viz";
import { registerChatRoutes } from "./chat";
import { registerDebugRoutes } from "./debug";

/** Register all application routes */
export function registerRoutes(app: Express): void {
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "pikachubball" });
  });

  // Register basic authentication routes (signup/login/logout)
  registerAuthRoutes(app);

  // Register modular route groups
  registerYahooOAuthRoutes(app);  // Yahoo OAuth + credentials
  registerYahooRoutes(app);       // Yahoo Fantasy API data
  registerVizRoutes(app);         // League visualizations
  registerChatRoutes(app);        // AI chat endpoint
  registerDebugRoutes(app);        // Debug endpoints (dev only)
}
