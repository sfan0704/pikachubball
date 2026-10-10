import type { Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseRequestClient } from "./auth/supabase-auth";
import type { AppConfig } from "../config/config";
import type { ServerDependencies } from "./dependencies";
import { createErrorHandler } from "./middleware/error-handler";
import { YahooApiClient } from "../fantasy/yahoo/yahoo-api-client";
import { systemClock as yahooTimers } from "../fantasy/yahoo/yahoo-request-policy";
import { YahooFantasyDataSource } from "../fantasy/fantasy-data-source";
import { YahooLeagueResources } from "../fantasy/league-resources";
import { refreshAccessToken, revokeYahooToken } from "../fantasy/yahoo/yahoo-auth";
import { AesGcmOwnerTokenCipher } from "../storage/owner-token-cipher";
import { createSupabaseOwnerStorage } from "../storage/supabase-owner-storage";
import { systemClock, type Clock } from "../utils/clock";
import { createLogger } from "../utils/logger";

/**
 * The one place that turns configuration into concrete collaborators.
 * Everything below receives what it needs through these dependencies.
 */
export function createServerDependencies(
  config: AppConfig,
  clock: Clock = systemClock
): ServerDependencies {
  const logger = createLogger({ debug: config.nodeEnv === "development" });
  const cipher = AesGcmOwnerTokenCipher.fromKeyring({
    currentKey: config.encryptionKey,
    currentVersion: config.encryptionKeyVersion,
    previousKey: config.encryptionKeyPrevious,
  });

  return {
    config,
    logger,
    clock,
    createSupabaseClient: (req: Request, res: Response): SupabaseClient =>
      createSupabaseRequestClient(req, res, config.auth),
    createOwnerStorage: (client, ownerId) => createSupabaseOwnerStorage(client, ownerId, cipher),
    revokeYahooGrant: (refreshToken) =>
      revokeYahooToken(
        refreshToken,
        config.yahoo.clientId ?? "",
        config.yahoo.clientSecret ?? "",
        fetch,
        config.yahoo.oauthBaseUrl
      ),
    createFantasyDataSource: (yahooClient) =>
      new YahooFantasyDataSource(new YahooLeagueResources(yahooClient), clock),
    createYahooClient: (userId, storage, onRequest) =>
      YahooApiClient.create(
        userId,
        storage,
        config.yahoo,
        { now: () => clock.now(), sleep: yahooTimers.sleep },
        onRequest,
        {
          refresher: (refreshToken, clientId, clientSecret, redirectUri) =>
            refreshAccessToken(
              refreshToken,
              clientId,
              clientSecret,
              redirectUri,
              fetch,
              config.yahoo.oauthBaseUrl
            ),
        }
      ),
  };
}

/** The error handler for an app built from these dependencies; register it after every route. */
export function createAppErrorHandler({ config, logger }: ServerDependencies) {
  return createErrorHandler({ logger, exposeErrorDetails: config.nodeEnv === "development" });
}
