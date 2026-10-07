import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AesGcmOwnerTokenCipher } from "../../../../server/storage/owner-token-cipher";
import { SupabaseOwnerStorage } from "../../../../server/storage/supabase-owner-storage";

const OWNER = "23f99d06-30ff-4767-8c41-21510b7fd5d0";
const KEY_1 = "11".repeat(32);
const KEY_2 = "22".repeat(32);
const KEY_3 = "33".repeat(32);

interface Row {
  owner_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  token_expires_at: number;
  token_version: number;
  encryption_key_version: number;
}

/** A one-row stand-in for the yahoo_connections table and the two RPCs that write it. */
function fakeDatabase() {
  const rows = new Map<string, Row>();
  const client = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      const existing = rows.get(OWNER);
      if (name === "upsert_yahoo_connection") {
        rows.set(OWNER, {
          owner_id: OWNER,
          access_token_ciphertext: args.p_access_token_ciphertext as string,
          refresh_token_ciphertext: args.p_refresh_token_ciphertext as string,
          token_expires_at: args.p_token_expires_at as number,
          token_version: (existing?.token_version ?? 0) + 1,
          encryption_key_version: args.p_encryption_key_version as number,
        });
        return { data: rows.get(OWNER)!.token_version, error: null };
      }
      rows.set(OWNER, {
        ...existing!,
        access_token_ciphertext: args.p_access_token_ciphertext as string,
        refresh_token_ciphertext: args.p_refresh_token_ciphertext as string,
        token_version: existing!.token_version + 1,
        encryption_key_version: args.p_encryption_key_version as number,
      });
      return { data: true, error: null };
    }),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: rows.get(OWNER) ?? null, error: null }) }),
      }),
    }),
  };
  return { rows, client: client as unknown as SupabaseClient };
}

function storageWith(client: SupabaseClient, cipher: AesGcmOwnerTokenCipher) {
  return new SupabaseOwnerStorage(client, OWNER, cipher);
}

describe("encryption key rotation", () => {
  it("keeps old tokens readable, moves refreshed ones to the new key, then drops the old key", async () => {
    const { rows, client } = fakeDatabase();

    // Before rotation: key 1 is the only key.
    const before = storageWith(
      client,
      AesGcmOwnerTokenCipher.fromKeyring({ currentKey: KEY_1, currentVersion: 1 })
    );
    await before.saveYahooConnection({
      userId: OWNER,
      yahooGuid: "guid",
      displayName: "Manager",
      email: null,
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAt: 1_800_000_000,
    });
    expect(rows.get(OWNER)!.encryption_key_version).toBe(1);

    // During rotation: key 2 is current, key 1 is previous.
    const during = storageWith(
      client,
      AesGcmOwnerTokenCipher.fromKeyring({
        currentKey: KEY_2,
        currentVersion: 2,
        previousKey: KEY_1,
      })
    );
    const stored = await during.getYahooToken(OWNER);
    expect(stored).toMatchObject({ accessToken: "access-1", refreshToken: "refresh-1" });

    // The next refresh re-encrypts with the current key and records its version.
    await during.saveYahooToken(
      {
        userId: OWNER,
        accessToken: "access-2",
        refreshToken: "refresh-2",
        expiresAt: 1_800_003_600,
      },
      { expectedVersion: stored!.version }
    );
    expect(rows.get(OWNER)!.encryption_key_version).toBe(2);
    expect(rows.get(OWNER)!.access_token_ciphertext).toMatch(/^v2\./);

    // After every row is migrated, the old key can be removed.
    const after = storageWith(
      client,
      AesGcmOwnerTokenCipher.fromKeyring({ currentKey: KEY_2, currentVersion: 2 })
    );
    await expect(after.getYahooToken(OWNER)).resolves.toMatchObject({
      accessToken: "access-2",
      refreshToken: "refresh-2",
    });
  });

  it("cannot read a row whose key was removed too early", () => {
    const old = AesGcmOwnerTokenCipher.fromKeyring({ currentKey: KEY_1, currentVersion: 1 });
    const encrypted = old.encrypt(OWNER, "access", "secret");
    const rotated = AesGcmOwnerTokenCipher.fromKeyring({ currentKey: KEY_2, currentVersion: 2 });

    expect(() => rotated.decrypt(OWNER, "access", encrypted)).toThrow(/invalid/);
  });

  it("only keeps the immediately previous key", () => {
    const v1 = AesGcmOwnerTokenCipher.fromKeyring({ currentKey: KEY_1, currentVersion: 1 });
    const v3 = AesGcmOwnerTokenCipher.fromKeyring({
      currentKey: KEY_3,
      currentVersion: 3,
      previousKey: KEY_2,
    });

    expect(() => v3.decrypt(OWNER, "access", v1.encrypt(OWNER, "access", "x"))).toThrow(/invalid/);
  });

  it("rejects a previous key with no older version to hold it", () => {
    expect(() =>
      AesGcmOwnerTokenCipher.fromKeyring({
        currentKey: KEY_2,
        currentVersion: 1,
        previousKey: KEY_1,
      })
    ).toThrow(/ENCRYPTION_KEY_VERSION/);
  });
});
