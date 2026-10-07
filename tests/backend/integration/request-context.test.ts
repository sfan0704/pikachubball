import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApp } from "../../../server/app";
import { createAppErrorHandler } from "../../../server/composition-root";
import type { YahooClientCreator } from "../../../server/request-context";
import type { YahooApiClient } from "../../../server/services/yahoo/yahoo-api-client";
import type { OwnerScopedStorage } from "../../../server/storage/yahoo-token-storage";
import { buildTestDependencies } from "../../support/dependencies";
import { recordingLogger } from "../../support/logger";
import { mockLeagueSettings, mockScoreboard } from "../fixtures/yahoo-responses";

const verifiedClient = {
  auth: {
    getClaims: async () => ({ data: { claims: { sub: "user-1" } }, error: null }),
    getUser: async () => ({
      data: {
        user: {
          id: "user-1",
          identities: [
            {
              provider: "custom:yahoo",
              identity_data: { iss: "https://api.login.yahoo.com", sub: "yahoo-guid-1" },
            },
          ],
          user_metadata: {},
          app_metadata: {},
        },
      },
      error: null,
    }),
  },
} as unknown as SupabaseClient;

const SECRET_TOKEN = "yahoo-access-token-do-not-log";

/** The app with a verified user, a stored Yahoo token and a Yahoo client that never leaves the machine. */
function buildApp() {
  const logger = recordingLogger();
  const getYahooToken = vi.fn().mockResolvedValue({
    userId: "user-1",
    accessToken: SECRET_TOKEN,
    refreshToken: "yahoo-refresh-token-do-not-log",
    expiresAt: 4_000_000_000,
  });
  const storage = {
    getYahooToken,
    ownsFantasyResource: vi.fn().mockResolvedValue(true),
  } as unknown as OwnerScopedStorage;

  const createYahooClient: YahooClientCreator = vi.fn(async (userId, ownerStorage, onRequest) => {
    await ownerStorage.getYahooToken(userId); // what the real client does once, at creation
    const respond = <T>(body: T) => {
      onRequest();
      return Promise.resolve(body);
    };
    return {
      getLeagueSettings: () => respond(mockLeagueSettings),
      getLeagueScoreboard: () => respond(mockScoreboard),
      getLeagueStandings: () => respond(mockLeagueSettings),
    } as unknown as YahooApiClient;
  });

  const dependencies = buildTestDependencies({
    logger,
    createSupabaseClient: () => verifiedClient,
    createOwnerStorage: () => storage,
    createYahooClient,
  });
  const app = createApp(dependencies);
  app.use(createAppErrorHandler(dependencies));
  return { app, logger, getYahooToken, createYahooClient };
}

describe("the request context, end to end", () => {
  it("makes one Yahoo client and one token read for a request that calls Yahoo twice", async () => {
    const { app, getYahooToken, createYahooClient } = buildApp();

    const response = await request(app).get("/api/yahoo/league-rankings/466.l.12345?week=3");

    expect(response.status).toBe(200);
    expect(createYahooClient).toHaveBeenCalledTimes(1);
    expect(getYahooToken).toHaveBeenCalledTimes(1);
  });

  it("logs one structured line per request with the route pattern, status, duration and Yahoo calls", async () => {
    const { app, logger } = buildApp();

    const response = await request(app).get("/api/yahoo/league-rankings/466.l.12345?week=3");

    const requestLines = logger.lines.filter((line) => line.message === "request");
    expect(requestLines).toHaveLength(1);
    expect(requestLines[0].level).toBe("info");
    expect(requestLines[0].fields).toEqual({
      requestId: response.headers["x-request-id"],
      method: "GET",
      route: "/api/yahoo/league-rankings/:leagueKey",
      status: 200,
      durationMs: expect.any(Number),
      yahooCalls: 2,
    });
  });

  it("never writes tokens or the league's data to the logs", async () => {
    const { app, logger } = buildApp();

    await request(app).get("/api/yahoo/league-rankings/466.l.12345?week=3");

    const everything = JSON.stringify(logger.lines);
    expect(everything).not.toContain(SECRET_TOKEN);
    expect(everything).not.toContain("do-not-log");
    expect(everything).not.toContain("466.l.12345");
  });

  it("logs unauthenticated and unmatched requests with zero Yahoo calls", async () => {
    const logger = recordingLogger();
    const dependencies = buildTestDependencies({ logger });
    const app = createApp(dependencies);
    app.use(createAppErrorHandler(dependencies));

    const missing = await request(app).get("/api/does-not-exist");
    const signedOut = await request(app).get("/api/auth/me");

    const lines = logger.lines.filter((line) => line.message === "request");
    expect(
      lines.map((line) => [line.fields.route, line.fields.status, line.fields.yahooCalls])
    ).toEqual([
      ["unmatched", 404, 0],
      ["/api/auth/me", 401, 0],
    ]);
    expect(missing.headers["x-request-id"]).toBe(lines[0].fields.requestId);
    expect(signedOut.headers["x-request-id"]).toBe(lines[1].fields.requestId);
  });

  it("answers the 61st data request in a minute with RATE_LIMITED and Retry-After", async () => {
    const { app } = buildApp();

    for (let i = 0; i < 60; i += 1) {
      await request(app).get("/api/yahoo/league-rankings/466.l.12345?week=3").expect(200);
    }
    const limited = await request(app).get("/api/yahoo/league-rankings/466.l.12345?week=3");

    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ code: "RATE_LIMITED" });
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("answers a user without a Yahoo connection with YAHOO_RECONNECT_REQUIRED", async () => {
    // The client creator reports the missing connection like the real client does.
    const { YahooReconnectRequiredError } =
      await import("../../../server/services/yahoo/yahoo-request-policy");
    const dependencies = buildTestDependencies({
      createSupabaseClient: () => verifiedClient,
      createOwnerStorage: () => ({ ownsFantasyResource: async () => true }) as OwnerScopedStorage,
      createYahooClient: async () => {
        throw new YahooReconnectRequiredError();
      },
    });
    const missingConnection = createApp(dependencies);
    missingConnection.use(createAppErrorHandler(dependencies));

    const response = await request(missingConnection).get("/api/yahoo/leagues");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "YAHOO_RECONNECT_REQUIRED" });
  });
});
