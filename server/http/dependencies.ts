import type { Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config/config";
import type { Logger } from "../utils/logger";
import type { YahooClientCreator } from "./request-context";
import type { OwnerScopedStorage } from "../storage/yahoo-token-storage";
import type { Clock } from "../utils/clock";
import type { FantasyDataSource } from "../fantasy/fantasy-data-source";
import type { YahooClientProvider } from "./request-context";

/**
 * Everything the composition root builds and hands to routes, middleware and
 * controllers. Nothing below the composition root reads configuration or
 * constructs these collaborators itself.
 */
export interface ServerDependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly clock: Clock;
  /** A Supabase client acting as the request's user. */
  createSupabaseClient(req: Request, res: Response): SupabaseClient;
  /** Owner-scoped storage for one signed-in user. */
  createOwnerStorage(client: SupabaseClient, ownerId: string): OwnerScopedStorage;
  /** A Yahoo API client for one user, reading tokens from their storage; `onRequest` runs for each HTTP attempt. */
  createYahooClient: YahooClientCreator;
  /** A fantasy data source that reads through the request's one Yahoo client. */
  createFantasyDataSource(yahooClient: YahooClientProvider): FantasyDataSource;
  /** Revokes a Yahoo refresh token at Yahoo; true when Yahoo confirmed it, and never throws. */
  revokeYahooGrant(refreshToken: string): Promise<boolean>;
}
