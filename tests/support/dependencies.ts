import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../../server/config/config";
import type { ServerDependencies } from "../../server/http/dependencies";
import type { Logger } from "../../server/utils/logger";
import type { RequestAccess } from "../../server/storage/yahoo-token-storage";
import { fixedClock } from "./clock";

/** A logger that records nothing and prints nothing. */
export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
};

/** Server configuration for tests; override only what a test cares about. */
export function buildTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: "test",
    port: 5000,
    trustProxy: false,
    buildId: "test-build",
    auth: {
      appOrigin: "https://basketball.example.test",
      supabaseUrl: "https://basketball-project.supabase.co",
      supabasePublishableKey: "sb_publishable_test",
      secureCookies: false,
    },
    encryptionKey: "0123456789abcdef".repeat(4),
    encryptionKeyVersion: 1,
    encryptionKeyPrevious: null,
    yahoo: {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      providerRedirectUri: "https://basketball.example.test/api/auth/yahoo/fantasy/callback",
      apiBaseUrl: "https://fantasysports.yahooapis.com/fantasy/v2",
      oauthBaseUrl: "https://api.login.yahoo.com",
    },
    localStack: false,
    localDailyStats: null,
    ...overrides,
  };
}

/** A Supabase client with no session: every identity check fails. */
export const anonymousSupabaseClient = {
  auth: {
    getClaims: async () => ({ data: null, error: new Error("no session") }),
  },
} as unknown as SupabaseClient;

/** A Supabase client whose signed claims name `user-1`; the session check is the storage's `openRequest`. */
export const signedInSupabaseClient = {
  auth: {
    getClaims: async () => ({ data: { claims: { sub: "user-1" } }, error: null }),
  },
} as unknown as SupabaseClient;

/** `openRequest` for a live Yahoo session, for owner-storage stand-ins. */
export async function openedRequest(): Promise<RequestAccess> {
  return { yahooGuid: "yahoo-guid-1", displayName: null };
}

/** Server dependencies for tests: anonymous by default, with a silent logger and a fixed clock. */
export function buildTestDependencies(
  overrides: Partial<ServerDependencies> = {}
): ServerDependencies {
  return {
    config: buildTestConfig(),
    logger: silentLogger,
    clock: fixedClock(),
    createSupabaseClient: () => anonymousSupabaseClient,
    createOwnerStorage: () => {
      throw new Error("createOwnerStorage was not provided by this test");
    },
    revokeYahooGrant: async () => false,
    createDailyStatsSource: null,
    projectionSource: null,
    features: { matchupAndLeague: false, players: false, projections: false },
    createFantasyDataSource: () => {
      throw new Error("createFantasyDataSource was not provided by this test");
    },
    createYahooClient: async () => {
      throw new Error("createYahooClient was not provided by this test");
    },
    ...overrides,
  };
}
