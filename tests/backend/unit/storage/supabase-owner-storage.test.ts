import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AesGcmOwnerTokenCipher } from "../../../../server/storage/owner-token-cipher";
import { SupabaseOwnerStorage } from "../../../../server/storage/supabase-owner-storage";

const OWNER_A = "23f99d06-30ff-4767-8c41-21510b7fd5d0";
const OWNER_B = "d86688b2-0b07-4ddc-955b-655d600312ff";
const cipher = AesGcmOwnerTokenCipher.fromHex("11".repeat(32));

function rpcClient(rpc: ReturnType<typeof vi.fn>): SupabaseClient {
  return { rpc } as unknown as SupabaseClient;
}

describe("owner-bound Yahoo token encryption", () => {
  it("decrypts only for the correct owner, purpose and untampered value", () => {
    const encrypted = cipher.encrypt(OWNER_A, "access", "synthetic-secret");

    expect(encrypted).not.toContain("synthetic-secret");
    expect(cipher.decrypt(OWNER_A, "access", encrypted)).toBe("synthetic-secret");
    expect(() => cipher.decrypt(OWNER_B, "access", encrypted)).toThrow(/authenticated/);
    expect(() => cipher.decrypt(OWNER_A, "refresh", encrypted)).toThrow(/authenticated/);
    expect(() => cipher.decrypt(OWNER_A, "access", `${encrypted}x`)).toThrow();
  });
});

describe("Supabase owner storage", () => {
  it("hands only ciphertext and the authenticated owner to the connection RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    const storage = new SupabaseOwnerStorage(rpcClient(rpc), OWNER_A, cipher);

    const saved = await storage.saveYahooConnection({
      userId: OWNER_A,
      yahooGuid: "synthetic-guid",
      displayName: "Manager A",
      email: "a@example.test",
      accessToken: "access-secret-a",
      refreshToken: "refresh-secret-a",
      expiresAt: 1_800_000_000,
    });

    expect(saved.version).toBe(1);
    const [, parameters] = rpc.mock.calls[0];
    expect(parameters).not.toEqual(expect.objectContaining({ owner_id: expect.anything() }));
    expect(JSON.stringify(parameters)).not.toContain("access-secret-a");
    expect(JSON.stringify(parameters)).not.toContain("refresh-secret-a");
    expect(parameters.p_access_token_ciphertext).toMatch(/^v1\./);
  });

  it("rejects a foreign owner before making a Data API request", async () => {
    const rpc = vi.fn();
    const storage = new SupabaseOwnerStorage(rpcClient(rpc), OWNER_A, cipher);

    await expect(
      storage.saveYahooConnection({
        userId: OWNER_B,
        yahooGuid: "foreign-guid",
        displayName: null,
        email: null,
        accessToken: "foreign-access",
        refreshToken: "foreign-refresh",
        expiresAt: 1_800_000_000,
      }),
    ).rejects.toThrow(/foreign user id/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses a compare-and-swap version so a stale refresh cannot win", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    const storage = new SupabaseOwnerStorage(rpcClient(rpc), OWNER_A, cipher);
    const rotation = {
      userId: OWNER_A,
      accessToken: "rotated-access",
      refreshToken: "rotated-refresh",
      expiresAt: 1_800_003_600,
    };

    await expect(
      storage.saveYahooToken(rotation, { expectedVersion: 4 }),
    ).resolves.toMatchObject({ version: 5 });
    await expect(
      storage.saveYahooToken(rotation, { expectedVersion: 4 }),
    ).rejects.toThrow(/stale result rejected/);
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "rotate_yahoo_tokens",
      expect.objectContaining({ p_expected_version: 4 }),
    );
  });
});
