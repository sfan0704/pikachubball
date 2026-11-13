import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AesGcmOwnerTokenCipher } from "../../../../server/storage/owner-token-cipher";
import {
  createSupabaseOwnerStorage,
  SupabaseOwnerStorage,
} from "../../../../server/storage/supabase-owner-storage";

const OWNER_A = "23f99d06-30ff-4767-8c41-21510b7fd5d0";
const OWNER_B = "d86688b2-0b07-4ddc-955b-655d600312ff";
const LEAGUE = "466.l.100000";
const cipher = AesGcmOwnerTokenCipher.fromHex("11".repeat(32));

/** One query result, as the Supabase client returns it. */
interface QueryResult {
  data: unknown;
  error: unknown;
}

/**
 * A Supabase client whose RPC calls and table reads answer from the given
 * handlers, recording every call. Table chains are thenable, like the real
 * PostgREST builder, so awaiting a chain resolves to its result.
 */
function fakeClient(options: {
  rpc?: (fn: string, params: unknown) => Promise<QueryResult>;
  table?: (table: string) => QueryResult;
}) {
  const rpcCalls: [string, unknown][] = [];
  const fromCalls: string[] = [];
  const eqCalls: [string, unknown][] = [];

  const chainFor = (table: string) => {
    const result = () => options.table?.(table) ?? { data: null, error: null };
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = (column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return chain;
    };
    chain.order = () => chain;
    chain.limit = async () => result();
    chain.maybeSingle = async () => result();
    chain.delete = () => chain;
    chain.upsert = () => chain;
    chain.then = (resolve: (value: QueryResult) => void) => {
      resolve(result());
    };
    return chain;
  };

  const client = {
    rpc: async (fn: string, params: unknown) => {
      rpcCalls.push([fn, params]);
      return options.rpc?.(fn, params) ?? { data: null, error: null };
    },
    from: (table: string) => {
      fromCalls.push(table);
      return chainFor(table);
    },
  } as unknown as SupabaseClient;
  return { client, rpcCalls, fromCalls, eqCalls };
}

function connectionRow(overrides: Record<string, unknown> = {}) {
  return {
    owner_id: OWNER_A,
    access_token_ciphertext: cipher.encrypt(OWNER_A, "access", "access-1"),
    refresh_token_ciphertext: cipher.encrypt(OWNER_A, "refresh", "refresh-1"),
    token_expires_at: 1_800_000_000,
    token_version: 1,
    ...overrides,
  };
}

function accessPayload(overrides: Record<string, unknown> = {}) {
  return {
    active: true,
    yahoo_guid: "guid-1",
    display_name: "Manager A",
    owns_league: null,
    connection: null,
    ...overrides,
  };
}

const connectionInput = {
  userId: OWNER_A,
  yahooGuid: "synthetic-guid",
  displayName: "Manager A",
  email: "a@example.test",
  accessToken: "access-secret-a",
  refreshToken: "refresh-secret-a",
  expiresAt: 1_800_000_000,
};

const tokenInput = {
  userId: OWNER_A,
  accessToken: "rotated-access",
  refreshToken: "rotated-refresh",
  expiresAt: 1_800_003_600,
};

describe("openRequest failures", () => {
  it("reports the database error with its code", async () => {
    const { client } = fakeClient({
      rpc: async () => ({ data: null, error: { code: "PGRST001", message: "boom" } }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.openRequest(null)).rejects.toThrow(
      "Supabase request access read failed (PGRST001)"
    );
  });

  it("rejects a session that is no longer active", async () => {
    const { client } = fakeClient({
      rpc: async () => ({ data: { active: false }, error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.openRequest(null)).rejects.toThrow("no longer active");
  });

  it("rejects a session that is not a Yahoo identity", async () => {
    const { client } = fakeClient({
      rpc: async () => ({ data: accessPayload({ yahoo_guid: null }), error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.openRequest(null)).rejects.toThrow("not a Yahoo identity");
  });

  it("rejects a malformed access payload", async () => {
    const { client } = fakeClient({
      rpc: async () => ({ data: { active: true }, error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.openRequest(null)).rejects.toThrow();
  });

  it("does not read ahead a league when no league was opened", async () => {
    const { client, fromCalls } = fakeClient({
      rpc: async () => ({ data: accessPayload({ owns_league: true }), error: null }),
      table: () => ({ data: [], error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);
    await storage.openRequest(null);

    await expect(storage.ownsLeague(LEAGUE)).resolves.toBe(false);
    expect(fromCalls).toContain("user_leagues");
  });
});

describe("saveYahooConnection failures", () => {
  it("reports an upsert error with its code", async () => {
    const { client } = fakeClient({
      rpc: async () => ({ data: null, error: { code: "23505", message: "conflict" } }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.saveYahooConnection(connectionInput)).rejects.toThrow(
      "Supabase connection upsert failed (23505)"
    );
  });

  it("rejects a non-number version without blaming a database code", async () => {
    const { client } = fakeClient({
      rpc: async () => ({ data: "one", error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.saveYahooConnection(connectionInput)).rejects.toThrow(
      "Supabase connection upsert failed (unknown)"
    );
  });
});

describe("saveYahooToken guards", () => {
  it("requires the version that was read", async () => {
    const { client, rpcCalls } = fakeClient({});
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.saveYahooToken(tokenInput)).rejects.toThrow(
      "requires the version that was read"
    );
    expect(rpcCalls).toEqual([]);
  });

  it("requires an integer version", async () => {
    const { client, rpcCalls } = fakeClient({});
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.saveYahooToken(tokenInput, { expectedVersion: 1.5 })).rejects.toThrow(
      "requires the version that was read"
    );
    expect(rpcCalls).toEqual([]);
  });

  it("rejects a foreign owner before making a request", async () => {
    const { client, rpcCalls } = fakeClient({});
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(
      storage.saveYahooToken({ ...tokenInput, userId: OWNER_B }, { expectedVersion: 1 })
    ).rejects.toThrow(/foreign user id/);
    expect(rpcCalls).toEqual([]);
  });

  it("reports a rotation error", async () => {
    const { client } = fakeClient({
      rpc: async () => ({ data: null, error: new Error("boom") }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.saveYahooToken(tokenInput, { expectedVersion: 2 })).rejects.toThrow(
      "Supabase token rotation failed (unknown)"
    );
  });
});

describe("getYahooToken from the database", () => {
  it("decrypts the stored row and converts a string expiry", async () => {
    const { client } = fakeClient({
      table: () => ({ data: connectionRow({ token_expires_at: "1800000000" }), error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.getYahooToken(OWNER_A)).resolves.toEqual({
      userId: OWNER_A,
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAt: 1_800_000_000,
      version: 1,
    });
  });

  it("reports no token when no row is stored", async () => {
    const { client } = fakeClient({
      table: () => ({ data: null, error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.getYahooToken(OWNER_A)).resolves.toBeUndefined();
  });

  it("reports a read error", async () => {
    const { client } = fakeClient({
      table: () => ({ data: null, error: { code: "PGRST001", message: "boom" } }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.getYahooToken(OWNER_A)).rejects.toThrow(
      "Supabase connection read failed (PGRST001)"
    );
  });

  it("rejects a row owned by someone else", async () => {
    const { client } = fakeClient({
      table: () => ({ data: connectionRow({ owner_id: OWNER_B }), error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.getYahooToken(OWNER_A)).rejects.toThrow(/foreign user id/);
  });
});

describe("deleteYahooToken", () => {
  it("deletes only the owner's row", async () => {
    const { client, fromCalls, eqCalls } = fakeClient({
      table: () => ({ data: null, error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.deleteYahooToken(OWNER_A)).resolves.toBeUndefined();
    expect(fromCalls).toEqual(["yahoo_connections"]);
    expect(eqCalls).toEqual([["owner_id", OWNER_A]]);
  });

  it("reports a delete error", async () => {
    const { client } = fakeClient({
      table: () => ({ data: null, error: new Error("boom") }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.deleteYahooToken(OWNER_A)).rejects.toThrow(
      "Supabase connection delete failed (unknown)"
    );
  });
});

describe("replaceFantasyMemberships", () => {
  it("sends the mapped memberships to the RPC", async () => {
    const { client, rpcCalls } = fakeClient({
      rpc: async () => ({ data: null, error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await storage.replaceFantasyMemberships([
      { leagueKey: "466.l.1", teamKey: "466.l.1.t.1" },
      { leagueKey: "466.l.2", teamKey: "466.l.2.t.3" },
    ]);

    expect(rpcCalls).toEqual([
      [
        "replace_fantasy_memberships",
        {
          p_memberships: [
            { league_key: "466.l.1", team_key: "466.l.1.t.1" },
            { league_key: "466.l.2", team_key: "466.l.2.t.3" },
          ],
        },
      ],
    ]);
  });

  it("reports a replacement error", async () => {
    const { client } = fakeClient({
      rpc: async () => ({ data: null, error: { code: "PGRST001", message: "boom" } }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.replaceFantasyMemberships([])).rejects.toThrow(
      "Supabase membership replacement failed (PGRST001)"
    );
  });
});

describe("ownsFantasyResource", () => {
  it("checks the league alone when no team is given", async () => {
    const { client, eqCalls } = fakeClient({
      table: () => ({ data: [{ league_key: LEAGUE }], error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.ownsFantasyResource(LEAGUE)).resolves.toBe(true);
    expect(eqCalls).toEqual([
      ["owner_id", OWNER_A],
      ["league_key", LEAGUE],
    ]);
  });

  it("says no when nothing matches", async () => {
    const { client } = fakeClient({
      table: () => ({ data: [], error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.ownsFantasyResource(LEAGUE)).resolves.toBe(false);
  });

  it("adds the team filter when a team is given", async () => {
    const { client, eqCalls } = fakeClient({
      table: () => ({ data: [{ league_key: LEAGUE }], error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.ownsFantasyResource(LEAGUE, "466.l.100000.t.2")).resolves.toBe(true);
    expect(eqCalls).toEqual([
      ["owner_id", OWNER_A],
      ["league_key", LEAGUE],
      ["team_key", "466.l.100000.t.2"],
    ]);
  });

  it("reports a read error", async () => {
    const { client } = fakeClient({
      table: () => ({ data: null, error: new Error("boom") }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.ownsFantasyResource(LEAGUE)).rejects.toThrow(
      "Supabase membership read failed (unknown)"
    );
  });
});

describe("preferences failures", () => {
  it("reports a preferences read error", async () => {
    const { client } = fakeClient({
      table: () => ({ data: null, error: { code: "PGRST001", message: "boom" } }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.getPreferences()).rejects.toThrow(
      "Supabase preferences read failed (PGRST001)"
    );
  });

  it("reports a preferences save error", async () => {
    const { client } = fakeClient({
      table: () => ({ data: null, error: new Error("boom") }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(
      storage.savePreferences({ selectedLeagueKey: null, selectedTeamKey: null, display: {} })
    ).rejects.toThrow("Supabase preferences save failed (unknown)");
  });
});

describe("listUserLeagues", () => {
  it("maps stored rows to leagues", async () => {
    const { client } = fakeClient({
      table: () => ({
        data: [
          {
            league_key: "466.l.1",
            team_key: "466.l.1.t.1",
            name: "League One",
            season: 2025,
            status: "active",
            synced_at: "2026-01-02T03:04:05Z",
          },
        ],
        error: null,
      }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.listUserLeagues()).resolves.toEqual([
      {
        leagueKey: "466.l.1",
        teamKey: "466.l.1.t.1",
        name: "League One",
        season: 2025,
        status: "active",
        syncedAt: "2026-01-02T03:04:05Z",
      },
    ]);
  });

  it("reports no leagues when the table answers null", async () => {
    const { client } = fakeClient({
      table: () => ({ data: null, error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.listUserLeagues()).resolves.toEqual([]);
  });

  it("reports a list error", async () => {
    const { client } = fakeClient({
      table: () => ({ data: null, error: { code: "PGRST001", message: "boom" } }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.listUserLeagues()).rejects.toThrow(
      "Supabase league list failed (PGRST001)"
    );
  });
});

describe("replaceUserLeagues failure", () => {
  it("reports a replacement error", async () => {
    const { client } = fakeClient({
      rpc: async () => ({ data: null, error: new Error("boom") }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.replaceUserLeagues([])).rejects.toThrow(
      "Supabase league replacement failed (unknown)"
    );
  });
});

describe("disconnect and deleteAccount", () => {
  it("reports a disconnect error", async () => {
    const { client } = fakeClient({
      rpc: async () => ({ data: null, error: { code: "PGRST001", message: "boom" } }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.disconnectYahoo()).rejects.toThrow(
      "Supabase disconnect failed (PGRST001)"
    );
  });

  it("deletes the account through the RPC", async () => {
    const { client, rpcCalls } = fakeClient({
      rpc: async () => ({ data: null, error: null }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.deleteAccount()).resolves.toBeUndefined();
    expect(rpcCalls).toEqual([["delete_my_account", undefined]]);
  });

  it("reports an account deletion error", async () => {
    const { client } = fakeClient({
      rpc: async () => ({ data: null, error: new Error("boom") }),
    });
    const storage = new SupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.deleteAccount()).rejects.toThrow(
      "Supabase account deletion failed (unknown)"
    );
  });
});

describe("createSupabaseOwnerStorage", () => {
  it("builds storage bound to the given owner", async () => {
    const { client } = fakeClient({
      table: () => ({ data: null, error: null }),
    });
    const storage = createSupabaseOwnerStorage(client, OWNER_A, cipher);

    await expect(storage.getYahooToken(OWNER_A)).resolves.toBeUndefined();
    await expect(storage.getYahooToken(OWNER_B)).rejects.toThrow(/foreign user id/);
  });
});
