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
import { FixtureDailyStatsSource } from "../fantasy/fixture/fixture-daily-stats-source";
import { YahooDailyStatsSource } from "../fantasy/yahoo-daily-stats-source";
import { DailyStatsRequests } from "../fantasy/yahoo/daily-stats-requests";
import type { YahooClientProvider } from "./request-context";
import type { Logger } from "../utils/logger";
import type { ProjectionSource } from "../fantasy/projection-source";
import type { Features } from "../../shared/api/account";

/** What the Yahoo daily-stats source gets from each request. */
interface DailyStatsRequestScope {
  readonly yahooClient: YahooClientProvider;
  readonly logger: Logger;
}

/**
 * Which daily-stats screens production shows. Each turns on only once every
 * dataset it reads is connected to Yahoo: Matchup and League since FAN-116,
 * Players at FAN-119.
 */
const YAHOO_DAILY_STATS_SCREENS = { matchupAndLeague: true, players: false } as const;

/**
 * Daily stats run on the fixture source wherever the Yahoo stand-in is in use
 * (local, CI, review), with every screen on, except the load test, which reads
 * the stand-in through the Yahoo source to count calls. Everywhere else they
 * read Yahoo, and production shows only the screens whose datasets are connected.
 */
function dailyStatsWiring(config: AppConfig, clock: Clock) {
  const projectionSource: ProjectionSource | null = null;
  const projections = projectionSource !== null;
  if (config.localDailyStats === "fixture") {
    const fixture = new FixtureDailyStatsSource(clock);
    return {
      createDailyStatsSource: () => fixture,
      projectionSource,
      features: { matchupAndLeague: true, players: true, projections } satisfies Features,
    };
  }
  return {
    createDailyStatsSource: ({ yahooClient, logger }: DailyStatsRequestScope) =>
      new YahooDailyStatsSource(new DailyStatsRequests(yahooClient, logger, clock)),
    projectionSource,
    features: (config.localStack
      ? { matchupAndLeague: true, players: true, projections }
      : { ...YAHOO_DAILY_STATS_SCREENS, projections }) satisfies Features,
  };
}

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
    ...dailyStatsWiring(config, clock),
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
