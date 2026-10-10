import express from "express";
import request from "supertest";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  AUTH_NO_STORE_HEADERS,
  hardenCookieOptions,
  projectYahooIdentity,
  readVerifiedYahooIdentity,
  requireYahooProviderTokens,
  YAHOO_ISSUER,
  YAHOO_PROVIDER,
} from "../../../../server/http/auth/supabase-auth";
import { createSupabaseAuthController } from "../../../../server/http/controllers/supabase-auth-controller";
import { createErrorHandler } from "../../../../server/http/middleware/error-handler";
import { buildTestConfig, silentLogger } from "../../../support/dependencies";
import { defined } from "../../../support/defined";
import { buildRequestScope } from "../../../support/context";
import { fixedClock } from "../../../support/clock";
import { recordingLogger } from "../../../support/logger";
import { AppError } from "../../../../shared/api/errors";
import type { Logger } from "../../../../server/utils/logger";
import type { OwnerScopedStorage } from "../../../../server/storage/yahoo-token-storage";
import type { DiscoveredLeague } from "../../../../server/fantasy/user-leagues";

const errorHandler = createErrorHandler({ logger: silentLogger, exposeErrorDetails: false });
const auth = buildTestConfig().auth;

const LEAGUE: DiscoveredLeague = {
  leagueKey: "478.l.1",
  teamKey: "478.l.1.t.4",
  name: "League One",
  season: 2026,
  status: "preseason",
};

/** The sign-in controller over fakes; Yahoo is reached only through `listLeagues`. */
function buildController(
  client: SupabaseClient,
  options: {
    saveYahooConnection?: Mock;
    replaceUserLeagues?: Mock;
    listLeagues?: Mock<() => Promise<DiscoveredLeague[]>>;
  } = {}
) {
  const storage = {
    saveYahooConnection: options.saveYahooConnection ?? vi.fn().mockResolvedValue({}),
    replaceUserLeagues: options.replaceUserLeagues ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as OwnerScopedStorage;
  const createOwnerStorage = vi.fn(() => storage);
  const controller = createSupabaseAuthController({
    auth,
    clock: fixedClock("2027-01-15T08:00:00.000Z"),
    createClient: () => client,
    createOwnerStorage,
    createYahooClient: async () => {
      throw new Error("the sign-in tests reach Yahoo only through listLeagues");
    },
    createFantasyDataSource: () => ({
      listLeagues: options.listLeagues ?? vi.fn().mockResolvedValue([LEAGUE]),
      getSeason: vi.fn(),
      getWeek: vi.fn(),
    }),
  });
  return { controller, createOwnerStorage };
}

/** An app serving one controller route, with the request scope the real app sets first. */
function serve(
  path: string,
  handler: express.RequestHandler,
  logger: Logger = silentLogger
): express.Express {
  const app = express();
  app.use((req, _res, next) => {
    req.scope = buildRequestScope({ logger });
    next();
  });
  app.get(path, handler);
  app.use(errorHandler);
  return app;
}

const USER_ID = "23f99d06-30ff-4767-8c41-21510b7fd5d0";

function yahooUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "player@example.test",
    email_confirmed_at: "2026-09-12T00:00:00.000Z",
    phone: "",
    confirmed_at: "2026-09-12T00:00:00.000Z",
    last_sign_in_at: "2026-09-12T00:00:00.000Z",
    app_metadata: { provider: YAHOO_PROVIDER, providers: [YAHOO_PROVIDER] },
    user_metadata: {},
    identities: [
      {
        identity_id: "identity-1",
        id: "yahoo-guid-1",
        user_id: USER_ID,
        identity_data: {
          iss: YAHOO_ISSUER,
          sub: "yahoo-guid-1",
          name: "Test Manager",
        },
        provider: YAHOO_PROVIDER,
        created_at: "2026-09-12T00:00:00.000Z",
        updated_at: "2026-09-12T00:00:00.000Z",
      },
    ],
    created_at: "2026-09-12T00:00:00.000Z",
    updated_at: "2026-09-12T00:00:00.000Z",
    is_anonymous: false,
    ...overrides,
  };
}

function yahooSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: "supabase-access-token",
    refresh_token: "supabase-refresh-token",
    expires_in: 3600,
    expires_at: 1_800_000_000,
    token_type: "bearer",
    provider_token: "yahoo-access-token",
    provider_refresh_token: "yahoo-refresh-token",
    user: yahooUser(),
    ...overrides,
  };
}

function fakeClient(auth: Record<string, unknown>): SupabaseClient {
  return { auth } as unknown as SupabaseClient;
}

describe("Supabase Yahoo auth boundary", () => {
  it("hardens every auth cookie and drops provider-supplied domains", () => {
    expect(
      hardenCookieOptions({ domain: ".example.test", sameSite: "none", path: "/callback" }, true)
    ).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(hardenCookieOptions({ domain: ".example.test" }, true)).not.toHaveProperty("domain");
  });

  it("projects only the expected Yahoo issuer and provider subject", () => {
    expect(projectYahooIdentity(yahooUser())).toEqual({
      userId: USER_ID,
      yahooGuid: "yahoo-guid-1",
      displayName: "Test Manager",
      email: "player@example.test",
    });

    const wrongIssuer = yahooUser();
    defined(wrongIssuer.identities)[0].identity_data = {
      ...defined(wrongIssuer.identities)[0].identity_data,
      iss: "https://attacker.example",
    };
    expect(() => projectYahooIdentity(wrongIssuer)).toThrow(/issuer/);

    expect(() => projectYahooIdentity(yahooUser({ identities: [] }))).toThrow(
      /not a Yahoo identity/
    );
  });

  it("requires server-only Yahoo access and refresh token handoff", () => {
    expect(requireYahooProviderTokens(yahooSession())).toEqual({
      accessToken: "yahoo-access-token",
      refreshToken: "yahoo-refresh-token",
    });
    expect(() =>
      requireYahooProviderTokens(yahooSession({ provider_refresh_token: null }))
    ).toThrow(/provider refresh token/);
  });

  it("rejects invalid claims and subject crossover", async () => {
    const invalidClaims = fakeClient({
      getClaims: vi.fn().mockResolvedValue({ data: null, error: new Error("bad") }),
    });
    await expect(readVerifiedYahooIdentity(invalidClaims)).rejects.toThrow(/claims/);

    const crossedUser = fakeClient({
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { sub: USER_ID } },
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: yahooUser({ id: "d86688b2-0b07-4ddc-955b-655d600312ff" }) },
        error: null,
      }),
    });
    await expect(readVerifiedYahooIdentity(crossedUser)).rejects.toThrow(/session user/);
  });

  it("starts only the custom Yahoo provider at the exact app callback", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: {
        url: "https://basketball-project.supabase.co/auth/v1/authorize?provider=custom%3Ayahoo",
      },
      error: null,
    });
    const { controller } = buildController(fakeClient({ signInWithOAuth }));
    const app = serve("/start", controller.beginYahooLogin);

    const response = await request(app).get("/start");

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("basketball-project.supabase.co/auth/v1/authorize");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: YAHOO_PROVIDER,
      options: {
        redirectTo: "https://basketball.example.test/api/auth/callback",
        skipBrowserRedirect: true,
        scopes: "openid profile email fspt-r",
        queryParams: {
          prompt: "consent",
        },
      },
    });
    for (const [header, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
      expect(response.headers[header.toLowerCase()]).toBe(value);
    }
  });

  it("stores the session's Yahoo tokens once and never exposes them", async () => {
    const exchangeCodeForSession = vi
      .fn()
      .mockResolvedValueOnce({ data: { session: yahooSession() }, error: null })
      .mockResolvedValueOnce({ data: { session: null }, error: new Error("used") });
    const saveYahooConnection = vi.fn().mockResolvedValue({});
    const { controller, createOwnerStorage } = buildController(
      fakeClient({ exchangeCodeForSession }),
      { saveYahooConnection }
    );
    const app = serve("/callback", controller.completeYahooLogin);

    const first = await request(app).get("/callback?code=one-time-code");
    const replay = await request(app).get("/callback?code=one-time-code");

    expect(first.status).toBe(303);
    expect(first.headers.location).toBe("/?yahoo_connected=true");
    expect(createOwnerStorage).toHaveBeenCalledWith(expect.anything(), USER_ID);
    expect(saveYahooConnection).toHaveBeenCalledTimes(1);
    expect(saveYahooConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        accessToken: "yahoo-access-token",
        refreshToken: "yahoo-refresh-token",
        expiresAt: Date.parse("2027-01-15T08:00:00.000Z") / 1000 + 3600,
      })
    );
    expect(replay.status).toBe(401);
    expect(first.text).not.toContain("yahoo-access-token");
    expect(first.headers.location).not.toContain("token");
  });

  it("saves the user's leagues after storing the tokens", async () => {
    const saveYahooConnection = vi.fn().mockResolvedValue({});
    const replaceUserLeagues = vi.fn().mockResolvedValue(undefined);
    const { controller } = buildController(
      fakeClient({
        exchangeCodeForSession: vi
          .fn()
          .mockResolvedValue({ data: { session: yahooSession() }, error: null }),
      }),
      { saveYahooConnection, replaceUserLeagues }
    );

    const response = await request(serve("/callback", controller.completeYahooLogin)).get(
      "/callback?code=one-time-code"
    );

    expect(response.status).toBe(303);
    expect(replaceUserLeagues).toHaveBeenCalledWith([
      {
        leagueKey: "478.l.1",
        teamKey: "478.l.1.t.4",
        name: "League One",
        season: 2026,
        isFinished: false,
      },
    ]);
    expect(saveYahooConnection.mock.invocationCallOrder[0]).toBeLessThan(
      defined(replaceUserLeagues.mock.invocationCallOrder[0])
    );
  });

  it("still signs in when the league sync fails, and logs only the error code", async () => {
    const replaceUserLeagues = vi.fn();
    const logger = recordingLogger();
    const { controller } = buildController(
      fakeClient({
        exchangeCodeForSession: vi
          .fn()
          .mockResolvedValue({ data: { session: yahooSession() }, error: null }),
      }),
      {
        replaceUserLeagues,
        listLeagues: vi.fn().mockRejectedValue(new AppError("YAHOO_UNAVAILABLE", "Yahoo is down")),
      }
    );

    const response = await request(serve("/callback", controller.completeYahooLogin, logger)).get(
      "/callback?code=one-time-code"
    );

    expect(response.status).toBe(303);
    expect(response.headers.location).toBe("/?yahoo_connected=true");
    expect(replaceUserLeagues).not.toHaveBeenCalled();
    expect(logger.lines).toEqual([
      expect.objectContaining({ level: "warn", fields: { code: "YAHOO_UNAVAILABLE" } }),
    ]);
  });

  it("rejects a callback without both Yahoo provider tokens and stores nothing", async () => {
    const saveYahooConnection = vi.fn();
    const { controller } = buildController(
      fakeClient({
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: yahooSession({ provider_refresh_token: null }) },
          error: null,
        }),
      }),
      { saveYahooConnection }
    );
    const app = serve("/callback", controller.completeYahooLogin);

    const response = await request(app).get("/callback?code=no-refresh-token");

    expect(response.status).toBe(401);
    expect(saveYahooConnection).not.toHaveBeenCalled();
  });

  it("rejects callback completion when the Yahoo identity is incomplete", async () => {
    const { controller } = buildController(
      fakeClient({
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: yahooSession({ user: yahooUser({ identities: [] }) }) },
          error: null,
        }),
      })
    );
    const app = serve("/callback", controller.completeYahooLogin);

    const response = await request(app).get("/callback?code=incomplete");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "UNAUTHORIZED",
      message: "Yahoo authentication response was incomplete",
      requestId: expect.any(String),
    });
  });
});
