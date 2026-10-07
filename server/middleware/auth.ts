import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../../shared/api/errors";
import { readVerifiedYahooIdentity } from "../auth/supabase-auth";
import type { ServerDependencies } from "../dependencies";
import { createRequestContext } from "../request-context";

/** Collaborators the sign-in check needs. */
export type RequireAuthDependencies = Pick<
  ServerDependencies,
  "createSupabaseClient" | "createOwnerStorage" | "createYahooClient" | "clock"
>;

/**
 * Builds the middleware that requires a verified Supabase session. It builds
 * the request's context (user, owner-scoped storage, clock, logger and the
 * lazily created Yahoo client) once, or passes UNAUTHORIZED on.
 */
export function createRequireAuth(dependencies: RequireAuthDependencies) {
  return async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (req.context) {
      next();
      return;
    }
    const scope = req.scope;
    if (!scope) {
      next(new Error("The request scope middleware must run before requireAuth"));
      return;
    }
    try {
      const client = dependencies.createSupabaseClient(req, res);
      const user = await readVerifiedYahooIdentity(client);
      req.context = createRequestContext({
        scope,
        user,
        storage: dependencies.createOwnerStorage(client, user.userId),
        clock: dependencies.clock,
        createYahooClient: dependencies.createYahooClient,
      });
      next();
    } catch {
      next(new UnauthorizedError());
    }
  };
}
