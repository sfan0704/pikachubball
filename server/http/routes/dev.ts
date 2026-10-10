import type { Express, Request, Response } from "express";
import { seedUser } from "../../dev/seed-users";
import type { ServerDependencies } from "../dependencies";
import { asyncHandler } from "../middleware/error-handler";
import { NotFoundError, UnauthorizedError } from "../../../shared/api/errors";

/**
 * Signs in as one of the seeded local managers, because the throwaway local
 * stack can't reach Yahoo. Registered only in local-stack mode, which the
 * configuration refuses in production.
 */
export function registerDevRoutes(
  app: Express,
  { config, createSupabaseClient }: Pick<ServerDependencies, "config" | "createSupabaseClient">
): void {
  if (!config.localStack) {
    return;
  }
  app.get(
    "/api/dev/login",
    asyncHandler(async (req: Request, res: Response) => {
      const user = seedUser(req.query.user);
      if (!user) {
        throw new NotFoundError("Seeded user");
      }
      const { error } = await createSupabaseClient(req, res).auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      if (error) {
        throw new UnauthorizedError("Could not sign in the seeded user; has the local seed run?");
      }
      res.redirect(303, "/");
    })
  );
}
