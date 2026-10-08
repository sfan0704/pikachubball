import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/error-handler";
import type { ServerDependencies } from "../dependencies";
import { getRequestContext } from "../request-context";
import { deleteAccount, disconnectYahoo } from "../services/account-service";

/** Thin HTTP adapter for disconnecting Yahoo and deleting the account. */
export function createAccountController({
  revokeYahooGrant,
  createSupabaseClient,
}: Pick<ServerDependencies, "revokeYahooGrant" | "createSupabaseClient">) {
  const operationFor = (req: Request) => {
    const { storage, logger, user } = getRequestContext(req);
    return { dependencies: { storage, revokeYahooGrant, logger }, userId: user.userId };
  };

  return {
    /** `DELETE /api/me/yahoo` */
    disconnectYahoo: asyncHandler(async (req: Request, res: Response) => {
      const { dependencies, userId } = operationFor(req);
      res.json(await disconnectYahoo(dependencies, userId));
    }),

    /** `DELETE /api/me` */
    deleteAccount: asyncHandler(async (req: Request, res: Response) => {
      const { dependencies, userId } = operationFor(req);
      const result = await deleteAccount(dependencies, userId);
      // The session belongs to a user that no longer exists; clear its cookies.
      const { error } = await createSupabaseClient(req, res).auth.signOut({ scope: "local" });
      if (error) {
        dependencies.logger.warn("Could not clear the session after account deletion");
      }
      res.json(result);
    }),
  };
}
