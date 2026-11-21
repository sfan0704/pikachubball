import type { Request, Response } from "express";
import { meResponseSchema, preferencesSchema } from "../../../shared/api/account";
import { asyncHandler } from "../middleware/error-handler";
import type { ServerDependencies } from "../dependencies";
import { getRequestContext } from "../request-context";
import { deleteAccount, disconnectYahoo } from "../../services/account-service";
import { getMe, savePreferences } from "../../services/me-service";
import type { Logger } from "../../utils/logger";

/** Thin HTTP adapter for disconnecting Yahoo and deleting the account; both end the session. */
export function createAccountController({
  revokeYahooGrant,
  createSupabaseClient,
  features,
}: Pick<ServerDependencies, "revokeYahooGrant" | "createSupabaseClient" | "features">) {
  const operationFor = (req: Request) => {
    const { storage, logger, user } = getRequestContext(req);
    return { dependencies: { storage, revokeYahooGrant, logger }, userId: user.userId };
  };

  // Signing in is signing in with Yahoo, so a removal also ends the app session.
  // The removal already happened, so a failure to clear cookies is logged, not raised.
  const endSession = async (req: Request, res: Response, logger: Logger) => {
    const { error } = await createSupabaseClient(req, res).auth.signOut({ scope: "local" });
    if (error) {
      logger.warn("Could not clear the session after removing the Yahoo connection");
    }
  };

  return {
    /** `GET /api/me` */
    getMe: asyncHandler(async (req: Request, res: Response) => {
      res.json(meResponseSchema.parse(await getMe(getRequestContext(req), features)));
    }),

    /** `PUT /api/me/preferences` */
    savePreferences: asyncHandler(async (req: Request, res: Response) => {
      const preferences = preferencesSchema.parse(req.body);
      res.json(await savePreferences(getRequestContext(req), preferences));
    }),

    /** `DELETE /api/me/yahoo` */
    disconnectYahoo: asyncHandler(async (req: Request, res: Response) => {
      const { dependencies, userId } = operationFor(req);
      const result = await disconnectYahoo(dependencies, userId);
      await endSession(req, res, dependencies.logger);
      res.json(result);
    }),

    /** `DELETE /api/me` */
    deleteAccount: asyncHandler(async (req: Request, res: Response) => {
      const { dependencies, userId } = operationFor(req);
      const result = await deleteAccount(dependencies, userId);
      await endSession(req, res, dependencies.logger);
      res.json(result);
    }),
  };
}
