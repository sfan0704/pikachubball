// Local tier only: token refresh races against the real owner-scoped storage
// and RLS. Yahoo is replaced by a controllable stub; storage is the real
// SupabaseOwnerStorage on the disposable stack. Run through `npm run test:db`.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { YahooApiClient } from "../../server/services/yahoo/yahoo-api-client";
import { YahooReconnectRequiredError } from "../../server/services/yahoo/yahoo-request-policy";
import { refreshAccessToken } from "../../server/yahoo-auth";
import { connect, database, signUpOwner, type Owner } from "./local-stack";

vi.mock("../../server/config/env", () => ({
  env: {
    YAHOO_CLIENT_ID: "synthetic-client",
    YAHOO_CLIENT_SECRET: "synthetic-secret",
  },
}));
vi.mock("../../server/yahoo-auth", () => ({ refreshAccessToken: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => (resolve = settle));
  return { promise, resolve };
}

async function expireAccessToken(owner: Owner): Promise<number> {
  const token = await owner.storage.getYahooToken(owner.id);
  if (token?.version === undefined) {
    throw new Error("Synthetic owner has no versioned connection");
  }
  const rotated = await owner.storage.saveYahooToken(
    { ...token, expiresAt: Math.floor(Date.now() / 1000) - 60 },
    { expectedVersion: token.version },
  );
  return rotated.version ?? 0;
}

beforeAll(async () => {
  await database.connect();
});

afterAll(async () => {
  await database.end();
});

beforeEach(() => {
  vi.mocked(refreshAccessToken).mockReset();
});

describe("Yahoo token refresh against owner-scoped storage", () => {
  it("does not recreate credentials when the user disconnects mid-refresh", async () => {
    const owner = await signUpOwner("disconnect");
    await connect(owner, "disconnect");
    await expireAccessToken(owner);
    const yahoo = deferred<{ accessToken: string; refreshToken: string; expiresIn: number }>();
    vi.mocked(refreshAccessToken).mockReturnValue(yahoo.promise);

    const pending = YahooApiClient.create(owner.id, owner.storage).catch((error) => error);
    await vi.waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce());
    await owner.storage.deleteYahooToken(owner.id);
    yahoo.resolve({ accessToken: "late-access", refreshToken: "late-refresh", expiresIn: 3600 });

    expect(await pending).toBeInstanceOf(YahooReconnectRequiredError);
    await expect(owner.storage.getYahooToken(owner.id)).resolves.toBeUndefined();
    await expect(YahooApiClient.create(owner.id, owner.storage)).rejects.toBeInstanceOf(
      YahooReconnectRequiredError,
    );
  });

  it("keeps the newer token when another instance committed first", async () => {
    const owner = await signUpOwner("instances");
    await connect(owner, "instances");
    const readVersion = await expireAccessToken(owner);
    const yahoo = deferred<{ accessToken: string; expiresIn: number }>();
    vi.mocked(refreshAccessToken).mockReturnValue(yahoo.promise);

    const pending = YahooApiClient.create(owner.id, owner.storage);
    await vi.waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce());
    // Another server instance finishes its own refresh first.
    await owner.storage.saveYahooToken(
      {
        userId: owner.id,
        accessToken: "other-instance-access",
        refreshToken: "other-instance-refresh",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
      { expectedVersion: readVersion },
    );
    yahoo.resolve({ accessToken: "late-access", expiresIn: 3600 });
    const client = await pending;

    const stored = await owner.storage.getYahooToken(owner.id);
    expect(stored).toMatchObject({
      accessToken: "other-instance-access",
      refreshToken: "other-instance-refresh",
      version: readVersion + 1,
    });
    expect((client as unknown as { accessToken: string }).accessToken).toBe(
      "other-instance-access",
    );
  });

  it("commits one refresh for concurrent requests and keeps the refresh token Yahoo omitted", async () => {
    const owner = await signUpOwner("concurrent");
    await connect(owner, "concurrent");
    const readVersion = await expireAccessToken(owner);
    const yahoo = deferred<{ accessToken: string; expiresIn: number }>();
    vi.mocked(refreshAccessToken).mockReturnValue(yahoo.promise);

    const requests = [
      YahooApiClient.create(owner.id, owner.storage),
      YahooApiClient.create(owner.id, owner.storage),
    ];
    await vi.waitFor(() => expect(refreshAccessToken).toHaveBeenCalled());
    yahoo.resolve({ accessToken: "shared-access", expiresIn: 3600 });
    await Promise.all(requests);

    expect(refreshAccessToken).toHaveBeenCalledOnce();
    await expect(owner.storage.getYahooToken(owner.id)).resolves.toMatchObject({
      accessToken: "shared-access",
      refreshToken: "refresh-secret-concurrent",
      version: readVersion + 1,
    });
  });
});
