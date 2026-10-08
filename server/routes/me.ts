import type { Express, RequestHandler } from "express";
import type { createAccountController } from "../controllers/account-controller";

/** What the account routes need. */
export interface MeRouteDependencies {
  readonly requireAuth: RequestHandler;
  readonly controller: ReturnType<typeof createAccountController>;
}

/** Register the account endpoints. */
export function registerMeRoutes(
  app: Express,
  { requireAuth, controller }: MeRouteDependencies
): void {
  app.get("/api/me", requireAuth, controller.getMe);
  app.put("/api/me/preferences", requireAuth, controller.savePreferences);
  app.delete("/api/me/yahoo", requireAuth, controller.disconnectYahoo);
  app.delete("/api/me", requireAuth, controller.deleteAccount);
}
