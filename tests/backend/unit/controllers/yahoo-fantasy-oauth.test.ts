import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../../server/config/env";
import { yahooOAuthController } from "../../../../server/controllers/yahoo-oauth-controller";
import { errorHandler } from "../../../../server/middleware/error-handler";
import { exchangeAuthorizationCode } from "../../../../server/yahoo-auth";

vi.mock("../../../../server/yahoo-auth", () => ({
  exchangeAuthorizationCode: vi.fn(),
}));

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
    process.env.NODE_ENV = "test";
    process.env.APP_ORIGIN = "https://basketball.example.test";
    process.env.SUPABASE_URL = "https://basketball-project.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    (env as any).NODE_ENV = "test";
    (env as any).YAHOO_CLIENT_ID = "fantasy-client-id";
    (env as any).YAHOO_CLIENT_SECRET = "fantasy-client-secret";
    (env as any).YAHOO_PROVIDER_REDIRECT_URI =
      "https://basketball.example.test/api/yahoo/return";
    saveYahooConnection.mockResolvedValue({});
  });

  afterEach(() => {
    delete process.env.APP_ORIGIN;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
  });

  function app() {
    const application = express();
    application.use((req, _res, next) => {
      req.authIdentity = IDENTITY;
      req.ownerStorage = { saveYahooConnection } as any;
      next();
    });
    application.get("/start", yahooOAuthController.beginFantasyAccess);
    application.get("/callback", yahooOAuthController.completeFantasyAccess);
    application.use(errorHandler);
    return application;
  }

  it("binds the authorization request to a short-lived HTTP-only state cookie", async () => {
    const response = await request(app()).get("/start");

    expect(response.status).toBe(302);
    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://api.login.yahoo.com");
    expect(location.searchParams.get("client_id")).toBe("fantasy-client-id");
    expect(location.searchParams.get("scope")).toBe("fspt-r");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://basketball.example.test/api/yahoo/return",
    );
    expect(location.searchParams.get("state")).toHaveLength(43);
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");
  });

  it("stores an approved Fantasy token only for the matching Yahoo account", async () => {
    const start = await request(app()).get("/start");
    const location = new URL(start.headers.location);
    const state = location.searchParams.get("state")!;
    const cookie = start.headers["set-cookie"][0].split(";")[0];
    vi.mocked(exchangeAuthorizationCode).mockResolvedValue({
      accessToken: "approved-access-token",
      refreshToken: "approved-refresh-token",
      expiresIn: 3600,
      yahooGuid: IDENTITY.yahooGuid,
    });

    const response = await request(app())
      .get(`/callback?code=one-time-code&state=${encodeURIComponent(state)}`)
      .set("Cookie", cookie);

    expect(response.status).toBe(303);
    expect(response.headers.location).toBe("/?yahoo_connected=true");
    expect(exchangeAuthorizationCode).toHaveBeenCalledWith(
      "one-time-code",
      "fantasy-client-id",
      "fantasy-client-secret",
      "https://basketball.example.test/api/yahoo/return",
    );
    expect(saveYahooConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: IDENTITY.userId,
        yahooGuid: IDENTITY.yahooGuid,
        accessToken: "approved-access-token",
        refreshToken: "approved-refresh-token",
      }),
    );
  });

  it("rejects state replay before exchanging a Yahoo code", async () => {
    const response = await request(app())
      .get("/callback?code=one-time-code&state=attacker-state")
      .set("Cookie", "pikachubball-yahoo-state=expected-state");

    expect(response.status).toBe(400);
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(saveYahooConnection).not.toHaveBeenCalled();
  });
});
