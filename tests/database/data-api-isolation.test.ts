// Local tier only: exercises the owner-scoped repository and RLS policies through
// the real Supabase Data API (PostgREST behind Kong) with real GoTrue sessions.
// Run through `npm run test:db`; no secret or service-role key is used by the
// clients under test.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AesGcmOwnerTokenCipher } from "../../server/storage/owner-token-cipher";
import { SupabaseOwnerStorage } from "../../server/storage/supabase-owner-storage";
import {
  cipher,
  connect,
  database,
  newClient,
  signUpOwner,
  type Owner,
} from "./local-stack";

let ownerA: Owner;
let ownerB: Owner;
const leagueA = { leagueKey: "466.l.101", teamKey: "466.l.101.t.1" };
const leagueB = { leagueKey: "466.l.202", teamKey: "466.l.202.t.5" };

beforeAll(async () => {
  await database.connect();
  [ownerA, ownerB] = await Promise.all([signUpOwner("a"), signUpOwner("b")]);
  await Promise.all([connect(ownerA, "a"), connect(ownerB, "b")]);
  await ownerA.storage.replaceFantasyMemberships([leagueA]);
  await ownerB.storage.replaceFantasyMemberships([leagueB]);
});

afterAll(async () => {
  await database.end();
});

describe("owner access through the Data API", () => {
  it("reads and decrypts its own connection through the repository", async () => {
    const token = await ownerA.storage.getYahooToken(ownerA.id);

    expect(token).toMatchObject({
      userId: ownerA.id,
      accessToken: "access-secret-a",
      refreshToken: "refresh-secret-a",
      expiresAt: 1_800_000_000,
      version: 1,
    });
  });

  it("persists only ciphertext bound to the current key version", async () => {
    const { data, error } = await ownerA.client
      .from("yahoo_connections")
      .select("*")
      .single();

    expect(error).toBeNull();
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("access-secret-a");
    expect(serialized).not.toContain("refresh-secret-a");
    expect(data.access_token_ciphertext).toMatch(/^v1\./);
    expect(data.encryption_key_version).toBe(cipher.keyVersion);

    const wrongKey = AesGcmOwnerTokenCipher.fromHex("33".repeat(32));
    expect(() =>
      wrongKey.decrypt(ownerA.id, "access", data.access_token_ciphertext),
    ).toThrow(/could not be authenticated/);
    expect(() =>
      cipher.decrypt(ownerB.id, "access", data.access_token_ciphertext),
    ).toThrow(/could not be authenticated/);
  });

  it("authorizes only its own league and team pairs", async () => {
    await expect(
      ownerA.storage.ownsFantasyResource(leagueA.leagueKey, leagueA.teamKey),
    ).resolves.toBe(true);
    await expect(
      ownerA.storage.ownsFantasyResource(leagueB.leagueKey),
    ).resolves.toBe(false);
    await expect(
      ownerA.storage.ownsFantasyResource(leagueB.leagueKey, leagueB.teamKey),
    ).resolves.toBe(false);
    await expect(
      ownerA.storage.ownsFantasyResource(leagueA.leagueKey, leagueB.teamKey),
    ).resolves.toBe(false);
  });
});

describe("cross-owner isolation through the Data API", () => {
  it("cannot select another owner's rows", async () => {
    const connections = await ownerB.client
      .from("yahoo_connections")
      .select("owner_id")
      .eq("owner_id", ownerA.id);
    const memberships = await ownerB.client
      .from("fantasy_memberships")
      .select("owner_id")
      .eq("owner_id", ownerA.id);

    expect(connections.error).toBeNull();
    expect(connections.data).toEqual([]);
    expect(memberships.error).toBeNull();
    expect(memberships.data).toEqual([]);
  });

  it("cannot insert rows owned by another user", async () => {
    const membership = await ownerB.client.from("fantasy_memberships").insert({
      owner_id: ownerA.id,
      league_key: "466.l.999",
      team_key: "466.l.999.t.9",
    });
    const connection = await ownerB.client.from("yahoo_connections").insert({
      owner_id: ownerA.id,
      yahoo_guid: `forged-${randomUUID()}`,
      access_token_ciphertext: "forged",
      refresh_token_ciphertext: "forged",
      token_expires_at: 1_800_000_000,
      encryption_key_version: 1,
    });

    expect(membership.error?.code).toBe("42501");
    expect(connection.error).not.toBeNull();
  });

  it("cannot update or delete another owner's rows", async () => {
    const update = await ownerB.client
      .from("yahoo_connections")
      .update({ display_name: "forged" })
      .eq("owner_id", ownerA.id)
      .select("owner_id");
    const deleteConnection = await ownerB.client
      .from("yahoo_connections")
      .delete()
      .eq("owner_id", ownerA.id)
      .select("owner_id");
    const deleteMembership = await ownerB.client
      .from("fantasy_memberships")
      .delete()
      .eq("owner_id", ownerA.id)
      .select("owner_id");

    expect(update.data).toEqual([]);
    expect(deleteConnection.data).toEqual([]);
    expect(deleteMembership.data).toEqual([]);

    const { data } = await ownerA.client
      .from("yahoo_connections")
      .select("display_name")
      .single();
    expect(data?.display_name).toBe("Manager a");
    await expect(
      ownerA.storage.ownsFantasyResource(leagueA.leagueKey, leagueA.teamKey),
    ).resolves.toBe(true);
  });

  it("cannot transfer its own rows to another owner", async () => {
    const connection = await ownerB.client
      .from("yahoo_connections")
      .update({ owner_id: ownerA.id })
      .eq("owner_id", ownerB.id);
    const membership = await ownerB.client
      .from("fantasy_memberships")
      .update({ owner_id: ownerA.id })
      .eq("owner_id", ownerB.id);

    expect(connection.error?.code).toBe("42501");
    expect(membership.error?.code).toBe("42501");
    await expect(
      ownerA.storage.ownsFantasyResource(leagueB.leagueKey),
    ).resolves.toBe(false);
  });

  it("cannot claim another manager's Yahoo GUID", async () => {
    const claim = await ownerB.storage
      .saveYahooConnection({
        userId: ownerB.id,
        yahooGuid: ownerA.yahooGuid,
        displayName: "Manager b",
        email: "b@example.test",
        accessToken: "access-secret-b",
        refreshToken: "refresh-secret-b",
        expiresAt: 1_800_000_000,
      })
      .catch((error) => error);
    const rewrite = await ownerB.client
      .from("yahoo_connections")
      .update({ yahoo_guid: ownerA.yahooGuid })
      .eq("owner_id", ownerB.id);

    expect(claim).toBeInstanceOf(Error);
    expect(claim.message).toMatch(/\(42501\)/);
    expect(rewrite.error?.code).toBe("42501");

    const reconnect = await connect(ownerA, "a");
    expect(reconnect.version).toBeGreaterThan(1);
    const { data } = await ownerB.client
      .from("yahoo_connections")
      .select("yahoo_guid")
      .single();
    expect(data?.yahoo_guid).toBe(ownerB.yahooGuid);
  });

  it("rejects a repository call for a foreign owner before any request", async () => {
    await expect(ownerB.storage.getYahooToken(ownerA.id)).rejects.toThrow(
      /foreign user id/,
    );
    await expect(ownerB.storage.deleteYahooToken(ownerA.id)).rejects.toThrow(
      /foreign user id/,
    );
  });
});

describe("unauthenticated Data API access", () => {
  const anon = newClient();

  it("cannot read either table", async () => {
    const connections = await anon.from("yahoo_connections").select("owner_id");
    const memberships = await anon.from("fantasy_memberships").select("owner_id");

    expect(connections.error?.code).toBe("42501");
    expect(memberships.error?.code).toBe("42501");
  });

  it("cannot write rows or call the owner RPCs", async () => {
    const insert = await anon.from("fantasy_memberships").insert({
      owner_id: ownerA.id,
      league_key: "466.l.999",
      team_key: "466.l.999.t.9",
    });
    const upsert = await anon.rpc("upsert_yahoo_connection", {
      p_yahoo_guid: "anon",
      p_display_name: null,
      p_email: null,
      p_access_token_ciphertext: "anon",
      p_refresh_token_ciphertext: "anon",
      p_token_expires_at: 1_800_000_000,
      p_encryption_key_version: 1,
    });
    const rotate = await anon.rpc("rotate_yahoo_tokens", {
      p_expected_version: 1,
      p_access_token_ciphertext: "anon",
      p_refresh_token_ciphertext: "anon",
      p_token_expires_at: 1_800_000_000,
      p_encryption_key_version: 1,
    });
    const replace = await anon.rpc("replace_fantasy_memberships", {
      p_memberships: [],
    });

    for (const result of [insert, upsert, rotate, replace]) {
      expect(result.error).not.toBeNull();
    }
  });
});

describe("tampering and concurrent refresh", () => {
  it("fails closed on tampered ciphertext without exposing values", async () => {
    const owner = await signUpOwner("tamper");
    await connect(owner, "tamper");
    const { data: row } = await owner.client
      .from("yahoo_connections")
      .select("access_token_ciphertext")
      .single();
    const parts = String(row?.access_token_ciphertext).split(".");
    parts[2] = parts[2].startsWith("A") ? `B${parts[2].slice(1)}` : `A${parts[2].slice(1)}`;
    await owner.client
      .from("yahoo_connections")
      .update({ access_token_ciphertext: parts.join(".") })
      .eq("owner_id", owner.id);

    const failure = await owner.storage.getYahooToken(owner.id).catch((error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toMatch(/could not be authenticated/);
    expect(failure.message).not.toContain("secret");
  });

  it("lets exactly one of two racing refreshes commit", async () => {
    const owner = await signUpOwner("race");
    await connect(owner, "race");
    const current = await owner.storage.getYahooToken(owner.id);
    if (current?.version === undefined) {
      throw new Error("Synthetic race owner has no versioned connection");
    }
    const { version } = current;
    const second = new SupabaseOwnerStorage(owner.client, owner.id, cipher);
    const rotation = (label: string) => ({
      userId: owner.id,
      accessToken: `access-${label}`,
      refreshToken: `refresh-${label}`,
      expiresAt: 1_800_003_600,
    });

    const results = await Promise.allSettled([
      owner.storage.saveYahooToken(rotation("one"), { expectedVersion: version }),
      second.saveYahooToken(rotation("two"), { expectedVersion: version }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0].reason)).toMatch(/stale result rejected/);

    const winner = (fulfilled[0] as PromiseFulfilledResult<{ accessToken: string }>).value;
    const stored = await owner.storage.getYahooToken(owner.id);
    expect(stored?.version).toBe(version + 1);
    expect(stored?.accessToken).toBe(winner.accessToken);

    await expect(
      owner.storage.saveYahooToken(rotation("stale"), { expectedVersion: version }),
    ).rejects.toThrow(/stale result rejected/);
  });
});
