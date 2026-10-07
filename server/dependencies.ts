import type { Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "./config/config";
import type { Logger } from "./utils/logger";
import type { OwnerScopedStorage, YahooTokenStorage } from "./storage/yahoo-token-storage";
import type { YahooApiClient } from "./services/yahoo/yahoo-api-client";

/**
 * Everything the composition root builds and hands to routes, middleware and
 * controllers. Nothing below the composition root reads configuration or
 * constructs these collaborators itself.
 */
export interface ServerDependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  /** A Supabase client acting as the request's user. */
  createSupabaseClient(req: Request, res: Response): SupabaseClient;
  /** Owner-scoped storage for one signed-in user. */
  createOwnerStorage(client: SupabaseClient, ownerId: string): OwnerScopedStorage;
  /** A Yahoo API client for one user, reading tokens from their storage. */
  createYahooClient(userId: string, storage: YahooTokenStorage): Promise<YahooApiClient>;
}
