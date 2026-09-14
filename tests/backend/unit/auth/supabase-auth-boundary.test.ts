import express from "express";
import request from "supertest";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_NO_STORE_HEADERS,
  hardenCookieOptions,
  projectYahooIdentity,
  readHostedAuthConfig,
  readVerifiedYahooIdentity,
  requireYahooProviderTokens,
  YAHOO_ISSUER,
  YAHOO_PROVIDER,
} from "../../../../server/auth/supabase-auth";
import { createSupabaseAuthController } from "../../../../server/controllers/supabase-auth-controller";
import { errorHandler } from "../../../../server/middleware/error-handler";

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
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.APP_ORIGIN = "https://basketball.example.test";
    process.env.SUPABASE_URL = "https://basketball-project.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  });

  afterEach(() => {
    delete process.env.APP_ORIGIN;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
  });

  it("accepts exact HTTPS origins and rejects path-bearing callbacks", () => {
    expect(readHostedAuthConfig()).toMatchObject({
      appOrigin: "https://basketball.example.test",
      supabaseUrl: "https://basketball-project.supabase.co",
      secureCookies: false,
    });

    process.env.APP_ORIGIN = "https://basketball.example.test/unexpected";
    expect(() => readHostedAuthConfig()).toThrow(/origin without/);
  });

  it("hardens every auth cookie and drops provider-supplied domains", () => {
    expect(
      hardenCookieOptions(
        { domain: ".example.test", sameSite: "none", path: "/callback" },
        true,
      ),
    ).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(
      hardenCookieOptions({ domain: ".example.test" }, true),
    ).not.toHaveProperty("domain");
  });

  it("projects only the expected Yahoo issuer and provider subject", () => {
    expect(projectYahooIdentity(yahooUser())).toEqual({
      userId: USER_ID,
      yahooGuid: "yahoo-guid-1",
      displayName: "Test Manager",
      email: "player@example.test",
    });

    const wrongIssuer = yahooUser();
    wrongIssuer.identities![0].identity_data = {
      ...wrongIssuer.identities![0].identity_data,
      iss: "https://attacker.example",
    };
    expect(() => projectYahooIdentity(wrongIssuer)).toThrow(/issuer/);

    expect(() => projectYahooIdentity(yahooUser({ identities: [] }))).toThrow(
      /not a Yahoo identity/,
    );
  });

  it("requires server-only Yahoo access and refresh token handoff", () => {
    expect(requireYahooProviderTokens(yahooSession())).toEqual({
      accessToken: "yahoo-access-token",
      refreshToken: "yahoo-refresh-token",
    });
    expect(() =>
      requireYahooProviderTokens(yahooSession({ provider_refresh_token: null })),
    ).toThrow(/provider refresh token/);
  });

  it("rejects invalid claims and subject crossover", async () => {
    const invalidClaims = fakeClient({
      getClaims: vi.fn().mockResolvedValue({ data: null, error: new Error("bad") }),
    });
    await expect(readVerifiedYahooIdentity(invalidClaims)).rejects.toThrow(
      /claims/,
    );

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
    await expect(readVerifiedYahooIdentity(crossedUser)).rejects.toThrow(
      /session user/,
    );
  });

  it("starts only the custom Yahoo provider at the exact app callback", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: {
        url: "https://basketball-project.supabase.co/auth/v1/authorize?provider=custom%3Ayahoo",
      },
      error: null,
    });
    const controller = createSupabaseAuthController({
      createClient: () => fakeClient({ signInWithOAuth }),
      createStorage: () => ({ saveYahooConnection: vi.fn() }),
      now: () => 1_800_000_000_000,
    });
    const app = express();
    app.get("/start", controller.beginYahooLogin);
    app.use(errorHandler);

    const response = await request(app).get("/start");

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain(
      "basketball-project.supabase.co/auth/v1/authorize",
    );
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

  it("persists provider tokens once and rejects callback replay", async () => {
    const exchangeCodeForSession = vi
      .fn()
      .mockResolvedValueOnce({ data: { session: yahooSession() }, error: null })
      .mockResolvedValueOnce({ data: { session: null }, error: new Error("used") });
    const saveYahooConnection = vi.fn().mockResolvedValue({});
    const controller = createSupabaseAuthController({
      createClient: () => fakeClient({ exchangeCodeForSession }),
      createStorage: () => ({ saveYahooConnection }),
      now: () => 1_800_000_000_000,
    });
    const app = express();
    app.get("/callback", controller.completeYahooLogin);
    app.use(errorHandler);

    const first = await request(app).get("/callback?code=one-time-code");
    const replay = await request(app).get("/callback?code=one-time-code");

    expect(first.status).toBe(303);
    expect(first.headers.location).toBe("/");
    expect(replay.status).toBe(401);
    expect(saveYahooConnection).toHaveBeenCalledOnce();
    expect(saveYahooConnection).toHaveBeenCalledWith({
      userId: USER_ID,
      yahooGuid: "yahoo-guid-1",
      displayName: "Test Manager",
      email: "player@example.test",
      accessToken: "yahoo-access-token",
      refreshToken: "yahoo-refresh-token",
      expiresAt: 1_800_003_600,
    });
    expect(first.text).not.toContain("yahoo-access-token");
    expect(first.headers.location).not.toContain("token");
  });

  it("creates no token handoff when callback verification is incomplete", async () => {
    const saveYahooConnection = vi.fn();
    const controller = createSupabaseAuthController({
      createClient: () =>
        fakeClient({
          exchangeCodeForSession: vi.fn().mockResolvedValue({
            data: { session: yahooSession({ provider_refresh_token: null }) },
            error: null,
      }),
      createStorage: () => ({ saveYahooConnection }),
      now: () => 1_800_000_000_000,
        }),
    });
    const app = express();
    app.get("/callback", controller.completeYahooLogin);
    app.use(errorHandler);

    const response = await request(app).get("/callback?code=incomplete");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Yahoo authentication response was incomplete",
      code: "UNAUTHORIZED",
    });
    expect(saveYahooConnection).not.toHaveBeenCalled();
  });
});
