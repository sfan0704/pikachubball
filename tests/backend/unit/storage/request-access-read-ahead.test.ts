import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { AesGcmOwnerTokenCipher } from "../../../../server/storage/owner-token-cipher";
import { SupabaseOwnerStorage } from "../../../../server/storage/supabase-owner-storage";

const OWNER = "23f99d06-30ff-4767-8c41-21510b7fd5d0";
const LEAGUE = "466.l.100000";
const cipher = AesGcmOwnerTokenCipher.fromHex("11".repeat(32));

function connection(version: number) {
  return {
    access_token_ciphertext: cipher.encrypt(OWNER, "access", `access-${version}`),
    refresh_token_ciphertext: cipher.encrypt(OWNER, "refresh", `refresh-${version}`),
    token_expires_at: 1_800_000_000,
    token_version: version,
  };
}

/** A client whose RPC answers `openRequest` and whose table reads answer from `rows`. */
function client(
  access: Record<string, unknown>,
  rows: { connection?: unknown; leagues?: unknown }
) {
  const rpc = vi.fn().mockResolvedValue({
    data: {
      active: true,
      yahoo_guid: "guid-1",
      display_name: null,
      owns_league: null,
      connection: null,
      ...access,
    },
    error: null,
  });
  const query = (table: string) => {
    const result =
      table === "yahoo_connections"
        ? { data: rows.connection ?? null, error: null }
        : { data: rows.leagues ?? [], error: null };
    const chain = {
      select: () => chain,
      eq: () => chain,
      limit: async () => result,
      maybeSingle: async () => result,
    };
    return chain;
  };
  const from = vi.fn(query);
  return { rpc, from, supabase: { rpc, from } as unknown as SupabaseClient };
}

describe("what openRequest reads ahead", () => {
  it("answers the opened league's check and the first token read without another call", async () => {
    const { from, supabase } = client({ owns_league: true, connection: connection(3) }, {});
    const storage = new SupabaseOwnerStorage(supabase, OWNER, cipher);
    await storage.openRequest(LEAGUE);

    await expect(storage.ownsLeague(LEAGUE)).resolves.toBe(true);
    await expect(storage.getYahooToken(OWNER)).resolves.toMatchObject({
      accessToken: "access-3",
      refreshToken: "refresh-3",
      version: 3,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("says a league is not the user's when the database said so", async () => {
    const { supabase } = client({ owns_league: false }, { leagues: [{ league_key: LEAGUE }] });
    const storage = new SupabaseOwnerStorage(supabase, OWNER, cipher);
    await storage.openRequest(LEAGUE);
    await expect(storage.ownsLeague(LEAGUE)).resolves.toBe(false);
  });

  it("asks the database about any other league", async () => {
    const { from, supabase } = client({ owns_league: true }, { leagues: [] });
    const storage = new SupabaseOwnerStorage(supabase, OWNER, cipher);
    await storage.openRequest(LEAGUE);
    await expect(storage.ownsLeague("466.l.999")).resolves.toBe(false);
    expect(from).toHaveBeenCalledWith("user_leagues");
  });

  it("reports a disconnected Yahoo account without another call", async () => {
    const { from, supabase } = client({ connection: null }, {});
    const storage = new SupabaseOwnerStorage(supabase, OWNER, cipher);
    await storage.openRequest(null);
    await expect(storage.getYahooToken(OWNER)).resolves.toBeUndefined();
    expect(from).not.toHaveBeenCalled();
  });

  it("reads tokens from the database after the first read, so a refresh race sees the latest", async () => {
    const latest = { owner_id: OWNER, ...connection(4) };
    const { from, supabase } = client({ connection: connection(3) }, { connection: latest });
    const storage = new SupabaseOwnerStorage(supabase, OWNER, cipher);
    await storage.openRequest(null);

    await expect(storage.getYahooToken(OWNER)).resolves.toMatchObject({ version: 3 });
    await expect(storage.getYahooToken(OWNER)).resolves.toMatchObject({ version: 4 });
    expect(from).toHaveBeenCalledWith("yahoo_connections");
  });

  it("drops the read-ahead tokens once the user disconnects", async () => {
    const { rpc, supabase } = client({ connection: connection(3) }, { connection: null });
    const storage = new SupabaseOwnerStorage(supabase, OWNER, cipher);
    await storage.openRequest(null);
    rpc.mockResolvedValue({ data: null, error: null });
    await storage.disconnectYahoo();
    await expect(storage.getYahooToken(OWNER)).resolves.toBeUndefined();
  });
});
