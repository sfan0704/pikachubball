import type { Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseRequestClient } from "./auth/supabase-auth";
import type { AppConfig } from "./config/config";
import type { ServerDependencies } from "./dependencies";
import { createErrorHandler } from "./middleware/error-handler";
import { YahooApiClient } from "./services/yahoo/yahoo-api-client";
import { AesGcmOwnerTokenCipher } from "./storage/owner-token-cipher";
import { createSupabaseOwnerStorage } from "./storage/supabase-owner-storage";
import { createLogger } from "./utils/logger";

/**
 * The one place that turns configuration into concrete collaborators.
 * Everything below receives what it needs through these dependencies.
 */
export function createServerDependencies(config: AppConfig): ServerDependencies {
  const logger = createLogger({ debug: config.nodeEnv === "development" });
  const cipher = AesGcmOwnerTokenCipher.fromHex(config.encryptionKey);

  return {
    config,
    logger,
    createSupabaseClient: (req: Request, res: Response): SupabaseClient =>
      createSupabaseRequestClient(req, res, config.auth),
    createOwnerStorage: (client, ownerId) => createSupabaseOwnerStorage(client, ownerId, cipher),
    createYahooClient: (userId, storage) => YahooApiClient.create(userId, storage, config.yahoo),
  };
}

/** The error handler for an app built from these dependencies; register it after every route. */
export function createAppErrorHandler({ config, logger }: ServerDependencies) {
  return createErrorHandler({ logger, exposeErrorDetails: config.nodeEnv === "development" });
}
