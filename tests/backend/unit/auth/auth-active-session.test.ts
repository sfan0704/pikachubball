import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { AesGcmOwnerTokenCipher } from "../../../../server/storage/owner-token-cipher";
import { SupabaseOwnerStorage } from "../../../../server/storage/supabase-owner-storage";

const OWNER = "23f99d06-30ff-4767-8c41-21510b7fd5d0";
const cipher = AesGcmOwnerTokenCipher.fromHex("11".repeat(32));
const LIVE = {
  active: true,
  yahoo_guid: "guid-1",
  display_name: "Manager A",
  owns_league: null,
  connection: null,
};

function storageFor(result: unknown) {
  const rpc = vi.fn().mockResolvedValue(result);
  const storage = new SupabaseOwnerStorage({ rpc } as unknown as SupabaseClient, OWNER, cipher);
  return { rpc, storage };
}

describe("active session boundary", () => {
  it("checks only the caller's session, passing nothing but the league key", async () => {
    const { rpc, storage } = storageFor({ data: LIVE, error: null });
    await expect(storage.openRequest("466.l.1")).resolves.toEqual({
      yahooGuid: "guid-1",
      displayName: "Manager A",
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("load_request_access", {
      p_league_key: "466.l.1",
    });
  });

  it("rejects a session ended by logout", async () => {
    const { storage } = storageFor({ data: { active: false }, error: null });
    await expect(storage.openRequest(null)).rejects.toThrow(/no longer active/);
  });

  it("rejects a live session that is not a Yahoo sign-in", async () => {
    const { storage } = storageFor({ data: { ...LIVE, yahoo_guid: null }, error: null });
    await expect(storage.openRequest(null)).rejects.toThrow(/not a Yahoo identity/);
  });

  it.each([
    { data: true, error: null },
    { data: null, error: null },
    { data: { active: "true" }, error: null },
    { data: { active: true }, error: null },
  ])("fails closed when the result is not the expected shape: %j", async (result) => {
    const { storage } = storageFor(result);
    await expect(storage.openRequest(null)).rejects.toThrow();
  });

  it("fails closed when the database reports an error", async () => {
    const { storage } = storageFor({ data: LIVE, error: { code: "PGRST202" } });
    await expect(storage.openRequest(null)).rejects.toThrow(/request access read failed/);
  });

  it("does not hide a transport failure", async () => {
    const { rpc, storage } = storageFor(null);
    rpc.mockRejectedValue(new Error("transport failed"));
    await expect(storage.openRequest(null)).rejects.toThrow("transport failed");
  });
});
