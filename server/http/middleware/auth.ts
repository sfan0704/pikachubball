import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../../../shared/api/errors";
import { readSignedClaims, type YahooSessionIdentity } from "../auth/supabase-auth";
import type { ServerDependencies } from "../dependencies";
import { createRequestContext } from "../request-context";

/** Collaborators the sign-in check needs. */
export type RequireAuthDependencies = Pick<
  ServerDependencies,
  "createSupabaseClient" | "createOwnerStorage" | "createYahooClient" | "clock"
>;

/** The league a route names; every league route calls it `:key`. */
function requestedLeagueKey(req: Request): string | null {
  const key = req.params.key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

/**
 * Builds the middleware that requires a verified Supabase session. It builds
 * the request's context (user, owner-scoped storage, clock, logger and the
 * lazily created Yahoo client) once, or passes UNAUTHORIZED on. It makes one
 * database call: the signed claims are checked locally, and `openRequest`
 * confirms the session and reads ahead the league check and Yahoo tokens.
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
      const claims = await readSignedClaims(client);
      const storage = dependencies.createOwnerStorage(client, claims.userId);
      const access = await storage.openRequest(requestedLeagueKey(req));
      const user: YahooSessionIdentity = { ...claims, ...access };
      req.context = createRequestContext({
        scope,
        user,
        storage,
        clock: dependencies.clock,
        createYahooClient: dependencies.createYahooClient,
      });
      next();
    } catch {
      next(new UnauthorizedError());
    }
  };
}
