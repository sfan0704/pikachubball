import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApp } from "../../../server/app";
import { createAppErrorHandler } from "../../../server/composition-root";
import type { OwnerScopedStorage } from "../../../server/storage/yahoo-token-storage";
import { buildTestDependencies } from "../../support/dependencies";

const APP_ORIGIN = "https://basketball.example.test";

function verifiedClient(signOut = vi.fn().mockResolvedValue({ error: null })) {
  return {
    auth: {
      signOut,
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
}

function buildApp(options: { revoked?: boolean; token?: boolean; signOutError?: boolean } = {}) {
  const calls: string[] = [];
  const storage = {
    getYahooToken: vi.fn(async () => {
      calls.push("read-token");
      return options.token === false ? undefined : { userId: "user-1", refreshToken: "refresh-1" };
    }),
    disconnectYahoo: vi.fn(async () => void calls.push("disconnect")),
    deleteAccount: vi.fn(async () => void calls.push("delete-account")),
  } as unknown as OwnerScopedStorage;
  const revokeYahooGrant = vi.fn(async () => {
    calls.push("revoke");
    return options.revoked ?? true;
  });
  const signOut = vi.fn().mockResolvedValue({
    error: options.signOutError ? new Error("no such user") : null,
  });
  const dependencies = buildTestDependencies({
    createSupabaseClient: () => verifiedClient(signOut),
    createOwnerStorage: () => storage,
    revokeYahooGrant,
  });
  const app = createApp(dependencies);
  app.use(createAppErrorHandler(dependencies));
  return { app, storage, revokeYahooGrant, signOut, calls };
}

describe("DELETE /api/me/yahoo", () => {
  it("revokes the grant at Yahoo, then deletes the stored tokens and leagues", async () => {
    const { app, revokeYahooGrant, calls } = buildApp();

    const response = await request(app).delete("/api/me/yahoo").set("Origin", APP_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ revokedAtYahoo: true });
    expect(revokeYahooGrant).toHaveBeenCalledWith("refresh-1");
    expect(calls).toEqual(["read-token", "revoke", "disconnect"]);
  });

  it("still deletes locally and says so when Yahoo does not confirm", async () => {
    const { app, storage } = buildApp({ revoked: false });

    const response = await request(app).delete("/api/me/yahoo").set("Origin", APP_ORIGIN);

    expect(response.body).toEqual({ revokedAtYahoo: false });
    expect(storage.disconnectYahoo).toHaveBeenCalledOnce();
  });

  it("still deletes locally when the tokens cannot be read", async () => {
    const { app, storage, revokeYahooGrant } = buildApp();
    vi.mocked(storage.getYahooToken).mockRejectedValue(new Error("storage down"));

    const response = await request(app).delete("/api/me/yahoo").set("Origin", APP_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ revokedAtYahoo: false });
    expect(revokeYahooGrant).not.toHaveBeenCalled();
    expect(storage.disconnectYahoo).toHaveBeenCalledOnce();
  });

  it("does not call Yahoo when nothing is connected", async () => {
    const { app, revokeYahooGrant } = buildApp({ token: false });

    const response = await request(app).delete("/api/me/yahoo").set("Origin", APP_ORIGIN);

    expect(response.status).toBe(200);
    expect(revokeYahooGrant).not.toHaveBeenCalled();
  });

  it("refuses a request from another origin and an anonymous request", async () => {
    const { app, storage } = buildApp();
    const crossOrigin = await request(app)
      .delete("/api/me/yahoo")
      .set("Origin", "https://evil.example");
    expect(crossOrigin.status).toBe(403);
    expect(storage.disconnectYahoo).not.toHaveBeenCalled();

    const dependencies = buildTestDependencies();
    const anonymous = createApp(dependencies);
    anonymous.use(createAppErrorHandler(dependencies));
    const response = await request(anonymous).delete("/api/me/yahoo").set("Origin", APP_ORIGIN);
    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/me", () => {
  it("revokes at Yahoo, deletes the account and signs the session out", async () => {
    const { app, signOut, calls } = buildApp();

    const response = await request(app).delete("/api/me").set("Origin", APP_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ revokedAtYahoo: true });
    expect(calls).toEqual(["read-token", "revoke", "delete-account"]);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("still succeeds when clearing the finished session fails", async () => {
    const { app, storage } = buildApp({ signOutError: true });

    const response = await request(app).delete("/api/me").set("Origin", APP_ORIGIN);

    expect(response.status).toBe(200);
    expect(storage.deleteAccount).toHaveBeenCalledOnce();
  });

  it("reports a failed deletion instead of pretending it worked", async () => {
    const { app, storage, signOut } = buildApp();
    vi.mocked(storage.deleteAccount).mockRejectedValue(new Error("rpc failed"));

    const response = await request(app).delete("/api/me").set("Origin", APP_ORIGIN);

    expect(response.status).toBe(500);
    expect(signOut).not.toHaveBeenCalled();
  });
});
