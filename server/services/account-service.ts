import type { Logger } from "../utils/logger";
import type { OwnerScopedStorage } from "../storage/yahoo-token-storage";

/** What an account operation needs, passed in so tests can replace Yahoo and storage. */
export interface AccountOperationDependencies {
  readonly storage: Pick<OwnerScopedStorage, "getYahooToken" | "disconnectYahoo" | "deleteAccount">;
  readonly revokeYahooGrant: (refreshToken: string) => Promise<boolean>;
  readonly logger: Logger;
}

/**
 * Asks Yahoo to revoke the user's grant. A failure never stops the local
 * deletion that follows: the user's data is removed either way.
 */
async function revokeAtYahoo(
  { storage, revokeYahooGrant, logger }: AccountOperationDependencies,
  userId: string
): Promise<boolean> {
  try {
    const token = await storage.getYahooToken(userId);
    return token ? await revokeYahooGrant(token.refreshToken) : false;
  } catch (error) {
    logger.warn("Could not read Yahoo tokens for revocation", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

/** Revokes the grant at Yahoo, then deletes the stored tokens and leagues. */
export async function disconnectYahoo(
  dependencies: AccountOperationDependencies,
  userId: string
): Promise<{ revokedAtYahoo: boolean }> {
  const revokedAtYahoo = await revokeAtYahoo(dependencies, userId);
  await dependencies.storage.disconnectYahoo();
  return { revokedAtYahoo };
}

/** Revokes the grant at Yahoo, then deletes the account and everything stored for it. */
export async function deleteAccount(
  dependencies: AccountOperationDependencies,
  userId: string
): Promise<{ revokedAtYahoo: boolean }> {
  const revokedAtYahoo = await revokeAtYahoo(dependencies, userId);
  await dependencies.storage.deleteAccount();
  return { revokedAtYahoo };
}
