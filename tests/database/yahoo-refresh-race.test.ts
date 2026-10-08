// Local tier only: token refresh races against the real owner-scoped storage
// and RLS. Yahoo is replaced by a controllable stub; storage is the real
// SupabaseOwnerStorage on the disposable stack. Run through `npm run test:db`.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { YahooTokenManager } from "../../server/services/yahoo/yahoo-token-manager";
import {
  systemClock,
  YahooReconnectRequiredError,
} from "../../server/services/yahoo/yahoo-request-policy";
import { refreshAccessToken } from "../../server/yahoo-auth";
import { connect, database, signUpOwner, type Owner } from "./local-stack";

const yahooApp = {
  clientId: "synthetic-client",
  clientSecret: "synthetic-secret",
  providerRedirectUri: "https://basketball.example.test/api/auth/yahoo/fantasy/callback",
};
vi.mock("../../server/yahoo-auth", () => ({ refreshAccessToken: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function expireAccessToken(owner: Owner): Promise<number> {
  const token = await owner.storage.getYahooToken(owner.id);
  if (token?.version === undefined) {
    throw new Error("Synthetic owner has no versioned connection");
  }
  const rotated = await owner.storage.saveYahooToken(
    { ...token, expiresAt: Math.floor(Date.now() / 1000) - 60 },
    { expectedVersion: token.version }
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

    const pending = YahooTokenManager.load(owner.id, owner.storage, yahooApp, systemClock).catch(
      (error) => error
    );
    await vi.waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce());
    await owner.storage.disconnectYahoo();
    yahoo.resolve({ accessToken: "late-access", refreshToken: "late-refresh", expiresIn: 3600 });

    expect(await pending).toBeInstanceOf(YahooReconnectRequiredError);
    await expect(owner.storage.getYahooToken(owner.id)).resolves.toBeUndefined();
    await expect(
      YahooTokenManager.load(owner.id, owner.storage, yahooApp, systemClock)
    ).rejects.toBeInstanceOf(YahooReconnectRequiredError);
  });

  it("keeps the newer token when another instance committed first", async () => {
    const owner = await signUpOwner("instances");
    await connect(owner, "instances");
    const readVersion = await expireAccessToken(owner);
    const yahoo = deferred<{ accessToken: string; expiresIn: number }>();
    vi.mocked(refreshAccessToken).mockReturnValue(yahoo.promise);

    const pending = YahooTokenManager.load(owner.id, owner.storage, yahooApp, systemClock);
    await vi.waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce());
    // Another server instance finishes its own refresh first.
    await owner.storage.saveYahooToken(
      {
        userId: owner.id,
        accessToken: "other-instance-access",
        refreshToken: "other-instance-refresh",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
      { expectedVersion: readVersion }
    );
    yahoo.resolve({ accessToken: "late-access", expiresIn: 3600 });
    const client = await pending;

    const stored = await owner.storage.getYahooToken(owner.id);
    expect(stored).toMatchObject({
      accessToken: "other-instance-access",
      refreshToken: "other-instance-refresh",
      version: readVersion + 1,
    });
    expect(client.accessToken).toBe("other-instance-access");
  });

  it("commits only one of two concurrent refreshes; the other adopts it, and the omitted refresh token is kept", async () => {
    const owner = await signUpOwner("concurrent");
    await connect(owner, "concurrent");
    const readVersion = await expireAccessToken(owner);
    const yahoo = deferred<{ accessToken: string; expiresIn: number }>();
    vi.mocked(refreshAccessToken).mockReturnValue(yahoo.promise);

    const requests = [
      YahooTokenManager.load(owner.id, owner.storage, yahooApp, systemClock),
      YahooTokenManager.load(owner.id, owner.storage, yahooApp, systemClock),
    ];
    await vi.waitFor(() => expect(refreshAccessToken).toHaveBeenCalledTimes(2));
    yahoo.resolve({ accessToken: "shared-access", expiresIn: 3600 });
    const clients = await Promise.all(requests);

    // Both asked Yahoo, but storage accepted a single write at readVersion + 1.
    for (const client of clients) {
      expect(client.accessToken).toBe("shared-access");
    }
    await expect(owner.storage.getYahooToken(owner.id)).resolves.toMatchObject({
      accessToken: "shared-access",
      refreshToken: "refresh-secret-concurrent",
      version: readVersion + 1,
    });
  });

  it("uses the token a concurrent request stored when Yahoo rejects the refresh token it already used", async () => {
    const owner = await signUpOwner("rejected-reuse");
    await connect(owner, "rejected-reuse");
    const readVersion = await expireAccessToken(owner);
    type Refreshed = { accessToken: string; refreshToken?: string; expiresIn: number };
    const winnerYahoo = deferred<Refreshed>();
    const loserYahoo = deferred<Refreshed>();
    vi.mocked(refreshAccessToken)
      .mockReturnValueOnce(winnerYahoo.promise)
      .mockReturnValueOnce(loserYahoo.promise);

    // Both requests read the same expired token and ask Yahoo to refresh it.
    const winner = YahooTokenManager.load(owner.id, owner.storage, yahooApp, systemClock);
    const loser = YahooTokenManager.load(owner.id, owner.storage, yahooApp, systemClock);
    await vi.waitFor(() => expect(refreshAccessToken).toHaveBeenCalledTimes(2));

    // Whichever request reached Yahoo first holds winnerYahoo: let it commit.
    winnerYahoo.resolve({
      accessToken: "rotated-access",
      refreshToken: "rotated-refresh",
      expiresIn: 3600,
    });
    await vi.waitFor(async () => {
      await expect(owner.storage.getYahooToken(owner.id)).resolves.toMatchObject({
        version: readVersion + 1,
      });
    });
    // Then Yahoo refuses the old refresh token the other request still holds.
    loserYahoo.reject(new YahooReconnectRequiredError());
    const clients = await Promise.all([winner, loser]);

    for (const client of clients) {
      expect(client.accessToken).toBe("rotated-access");
    }
    await expect(owner.storage.getYahooToken(owner.id)).resolves.toMatchObject({
      refreshToken: "rotated-refresh",
      version: readVersion + 1,
    });
  });

  it("still asks to reconnect when Yahoo rejects the refresh and nothing newer was stored", async () => {
    const owner = await signUpOwner("rejected-alone");
    await connect(owner, "rejected-alone");
    await expireAccessToken(owner);
    vi.mocked(refreshAccessToken).mockRejectedValue(new YahooReconnectRequiredError());

    await expect(
      YahooTokenManager.load(owner.id, owner.storage, yahooApp, systemClock)
    ).rejects.toBeInstanceOf(YahooReconnectRequiredError);
  });
});
