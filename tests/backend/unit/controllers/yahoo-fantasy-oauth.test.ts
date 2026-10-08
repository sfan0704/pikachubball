import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerYahooOAuthRoutes } from "../../../../server/http/routes/yahoo-oauth";
import { createYahooOAuthController } from "../../../../server/http/controllers/yahoo-oauth-controller";
import { createErrorHandler } from "../../../../server/http/middleware/error-handler";
import { buildTestConfig, silentLogger } from "../../../support/dependencies";
import type { OwnerScopedStorage } from "../../../../server/storage/yahoo-token-storage";
import { buildRequestContext } from "../../../support/context";
import { systemClock } from "../../../../server/utils/clock";
import { exchangeAuthorizationCode } from "../../../../server/fantasy/yahoo/yahoo-auth";
import { defined } from "../../../support/defined";

vi.mock("../../../../server/fantasy/yahoo/yahoo-auth", () => ({
  exchangeAuthorizationCode: vi.fn(),
}));

const config = buildTestConfig({
  yahoo: {
    clientId: "fantasy-client-id",
    clientSecret: "fantasy-client-secret",
    providerRedirectUri: "https://basketball.example.test/api/auth/yahoo/fantasy/callback",
  },
});
const yahooOAuthController = createYahooOAuthController({ config });
const errorHandler = createErrorHandler({ logger: silentLogger, exposeErrorDetails: false });

const IDENTITY = {
  userId: "23f99d06-30ff-4767-8c41-21510b7fd5d0",
  yahooGuid: "yahoo-guid-1",
  displayName: "Test Manager",
  email: "player@example.test",
};

describe("Yahoo Fantasy OAuth handoff", () => {
  const saveYahooConnection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    saveYahooConnection.mockResolvedValue({});
  });

  function app() {
    const application = express();
    application.use((req, _res, next) => {
      req.context = buildRequestContext({
        user: IDENTITY,
        storage: { saveYahooConnection } as unknown as OwnerScopedStorage,
        clock: systemClock,
      });
      next();
    });
    registerYahooOAuthRoutes(application, {
      requireAuth: (_req, _res, next) => next(),
      skipRateLimit: true,
      controller: yahooOAuthController,
    });
    application.use(errorHandler);
    return application;
  }

  it("binds the authorization request to a short-lived HTTP-only state cookie", async () => {
    const response = await request(app()).get("/connect/start");

    expect(response.status).toBe(302);
    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://api.login.yahoo.com");
    expect(location.searchParams.get("client_id")).toBe("fantasy-client-id");
    // Yahoo Fantasy access is granted at the application level. Supplying an
    // OAuth scope here can yield a token that Yahoo rejects at the Fantasy API.
    expect(location.searchParams.has("scope")).toBe(false);
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://basketball.example.test/api/auth/yahoo/fantasy/callback"
    );
    expect(location.searchParams.get("state")).toHaveLength(43);
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");
    expect(response.headers["set-cookie"][0]).toContain("Path=/");
  });

  it("stores an approved Fantasy token only for the matching Yahoo account", async () => {
    const start = await request(app()).get("/connect/start");
    const location = new URL(start.headers.location);
    const state = defined(location.searchParams.get("state"));
    const cookie = start.headers["set-cookie"][0].split(";")[0];
    vi.mocked(exchangeAuthorizationCode).mockResolvedValue({
      accessToken: "approved-access-token",
      refreshToken: "approved-refresh-token",
      expiresIn: 3600,
      yahooGuid: IDENTITY.yahooGuid,
    });

    const response = await request(app())
      .get(`/api/auth/yahoo/fantasy/callback?code=one-time-code&state=${encodeURIComponent(state)}`)
      .set("Cookie", cookie);

    expect(response.status).toBe(303);
    expect(response.headers.location).toBe("/?yahoo_connected=true");
    expect(exchangeAuthorizationCode).toHaveBeenCalledWith(
      "one-time-code",
      "fantasy-client-id",
      "fantasy-client-secret",
      "https://basketball.example.test/api/auth/yahoo/fantasy/callback"
    );
    expect(saveYahooConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: IDENTITY.userId,
        yahooGuid: IDENTITY.yahooGuid,
        accessToken: "approved-access-token",
        refreshToken: "approved-refresh-token",
      })
    );
  });

  it("stores a legacy Fantasy token when Yahoo omits the optional guid", async () => {
    const start = await request(app()).get("/connect/start");
    const location = new URL(start.headers.location);
    const state = defined(location.searchParams.get("state"));
    const cookie = start.headers["set-cookie"][0].split(";")[0];
    vi.mocked(exchangeAuthorizationCode).mockResolvedValue({
      accessToken: "legacy-access-token",
      refreshToken: "legacy-refresh-token",
      expiresIn: 3600,
    });

    const response = await request(app())
      .get(`/api/auth/yahoo/fantasy/callback?code=one-time-code&state=${encodeURIComponent(state)}`)
      .set("Cookie", cookie);

    expect(response.status).toBe(303);
    expect(saveYahooConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: IDENTITY.userId,
        yahooGuid: IDENTITY.yahooGuid,
        accessToken: "legacy-access-token",
      })
    );
  });

  it("rejects state replay before exchanging a Yahoo code", async () => {
    const response = await request(app())
      .get("/api/auth/yahoo/fantasy/callback?code=one-time-code&state=attacker-state")
      .set("Cookie", "pikachubball-yahoo-state=expected-state");

    expect(response.status).toBe(400);
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(saveYahooConnection).not.toHaveBeenCalled();
  });
});

describe("Fantasy connection rate limit", () => {
  it("answers the eleventh start in a minute with RATE_LIMITED", async () => {
    const application = express();
    application.use((req, _res, next) => {
      req.context = buildRequestContext({ user: IDENTITY, clock: systemClock });
      next();
    });
    registerYahooOAuthRoutes(application, {
      requireAuth: (_req, _res, next) => next(),
      skipRateLimit: false,
      controller: yahooOAuthController,
    });
    application.use(errorHandler);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(application).get("/connect/start").expect(302);
    }
    const limited = await request(application).get("/connect/start");

    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ code: "RATE_LIMITED" });
  });
});
