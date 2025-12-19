import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./auth";
import { registerYahooOAuthRoutes } from "./yahoo-oauth";
import { registerYahooRoutes } from "./yahoo";
import { registerVizRoutes } from "./viz";
import { registerChatRoutes } from "./chat";
import { registerDebugRoutes } from "./debug";

/** Register all application routes */
export async function registerRoutes(app: Express): Promise<Server> {
  // Register basic authentication routes (signup/login/logout)
  registerAuthRoutes(app);

  // Register modular route groups
  registerYahooOAuthRoutes(app);  // Yahoo OAuth + credentials
  registerYahooRoutes(app);       // Yahoo Fantasy API data
  registerVizRoutes(app);         // League visualizations
  registerChatRoutes(app);        // AI chat endpoint
  registerDebugRoutes(app);        // Debug endpoints (dev only)

  const server = createServer(app);
  return server;
}
