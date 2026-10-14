import { createHash } from "node:crypto";
import express from "express";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import {
  createSupabaseRequestClient,
  YAHOO_ISSUER,
  YAHOO_PROVIDER,
} from "../../server/http/auth/supabase-auth";
import { createSupabaseAuthController } from "../../server/http/controllers/supabase-auth-controller";
import { createRequireAuth } from "../../server/http/middleware/auth";
import { createErrorHandler } from "../../server/http/middleware/error-handler";
import type { OwnerScopedStorage } from "../../server/storage/yahoo-token-storage";
import { buildTestConfig, silentLogger } from "./dependencies";
import { buildRequestScope } from "./context";
import { fixedClock } from "./clock";
import { networkGuard } from "./network-guard";

const USER_ID = "23f99d06-30ff-4767-8c41-21510b7fd5d0";
const auth = buildTestConfig().auth;
const user: User = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  phone: "",
  email: "manager@example.test",
  app_metadata: { provider: YAHOO_PROVIDER },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  identities: [
    {
      identity_id: "synthetic-identity",
      id: "synthetic-guid",
      user_id: USER_ID,
      identity_data: { sub: "synthetic-guid", iss: YAHOO_ISSUER },
      provider: YAHOO_PROVIDER,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
};
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
// HS256 makes getClaims delegate trust to our mocked Auth getUser endpoint.
// This is not a signature/nonce test of Supabase itself; no real identity server is contacted.
const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
  sub: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  exp: 2_400_000_000,
  iat: 1_767_225_600,
})}.${Buffer.from("synthetic-signature").toString("base64url")}`;

/** Real SSR SDK/Express routes over a PKCE-bound synthetic Auth transport and recording storage. */
export function syntheticAuth() {
  const codes = new Map<string, { challenge: string; incomplete: boolean; used: boolean }>();
  const save = vi.fn().mockResolvedValue({});
  const storage = {
    saveYahooConnection: save,
    replaceUserLeagues: vi.fn().mockResolvedValue(undefined),
  } as unknown as OwnerScopedStorage;
  networkGuard.use(
    http.post(`${auth.supabaseUrl}/auth/v1/token`, async ({ request }) => {
      const body = z
        .object({ auth_code: z.string(), code_verifier: z.string() })
        .parse(await request.json());
      const code = codes.get(body.auth_code);
      const challenge = createHash("sha256").update(body.code_verifier).digest("base64url");
      if (!code || code.used || challenge !== code.challenge) {
        return HttpResponse.json(
          { error: "invalid_grant", error_description: "Synthetic PKCE rejected" },
          { status: 400 }
        );
      }
      code.used = true;
      return HttpResponse.json({
        access_token: accessToken,
        refresh_token: "synthetic-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user,
        provider_token: "synthetic-yahoo-access",
        provider_refresh_token: code.incomplete ? null : "synthetic-yahoo-refresh",
      });
    }),
    http.get(`${auth.supabaseUrl}/auth/v1/user`, ({ request }) => {
      if (request.headers.get("authorization") !== `Bearer ${accessToken}`) {
        return HttpResponse.json({ message: "Synthetic session rejected" }, { status: 401 });
      }
      return HttpResponse.json(user);
    }),
    http.post(`${auth.supabaseUrl}/auth/v1/logout`, () => new HttpResponse(null, { status: 204 }))
  );

  function app() {
    const server = express();
    server.use((req, _res, next) => {
      req.scope = buildRequestScope({ logger: silentLogger });
      next();
    });
    const dependencies = {
      auth,
      clock: fixedClock("2027-01-15T08:00:00Z"),
      createClient: (req: express.Request, res: express.Response) =>
        createSupabaseRequestClient(req, res, auth),
      createOwnerStorage: () => storage,
      createYahooClient: async () => {
        throw new Error("Synthetic auth tests cannot reach Yahoo");
      },
      createFantasyDataSource: () => ({
        listLeagues: vi.fn().mockResolvedValue([]),
        getSeason: vi.fn(),
        getWeek: vi.fn(),
      }),
    };
    const controller = createSupabaseAuthController(dependencies);
    server.get("/start", controller.beginYahooLogin);
    server.get("/callback", controller.completeYahooLogin);
    server.post("/logout", controller.logout);
    server.get(
      "/protected",
      createRequireAuth({ ...dependencies, createSupabaseClient: dependencies.createClient }),
      (req, res) => res.json({ userId: req.context?.user.userId })
    );
    server.use(createErrorHandler({ logger: silentLogger, exposeErrorDetails: false }));
    return server;
  }

  /** Register only the public PKCE challenge from the synthetic login-start URL. */
  function issue(startUrl: string, name: string, incomplete = false): string {
    const challenge = new URL(startUrl).searchParams.get("code_challenge");
    if (!challenge) throw new Error("SDK did not generate a PKCE challenge");
    codes.set(name, { challenge, incomplete, used: false });
    return `/callback?code=${name}`;
  }
  return { app, issue, save };
}
