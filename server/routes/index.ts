import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./auth";
import { registerYahooRoutes } from "./yahoo";
import { registerVizRoutes } from "./viz";
import { registerChatRoutes } from "./chat";
import { registerAuthRoutes as registerAuthEndpoints } from "../auth-routes";

/** Register all application routes */
export async function registerRoutes(app: Express): Promise<Server> {
  // Register local authentication routes (signup/login)
  registerAuthEndpoints(app);

  // Register modular route groups
  registerAuthRoutes(app);     // Yahoo OAuth + credentials
  registerYahooRoutes(app);    // Yahoo Fantasy API data
  registerVizRoutes(app);      // League visualizations
  registerChatRoutes(app);     // AI chat endpoint

  const server = createServer(app);
  return server;
}
