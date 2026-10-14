import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { readVerifiedYahooIdentity } from "../../../../server/http/auth/supabase-auth";

function client(result: unknown) {
  const rpc = vi.fn().mockResolvedValue(result);
  return {
    rpc,
    auth: {
      getClaims: async () => ({ data: { claims: { sub: "user-1" } }, error: null }),
      getUser: async () => ({
        data: {
          user: {
            id: "user-1",
            identities: [{ provider: "custom:yahoo", identity_data: { sub: "guid-1" } }],
          },
        },
        error: null,
      }),
    },
  };
}

describe("active session boundary", () => {
  it("checks only the caller's session with no supplied identifiers", async () => {
    const verified = client({ data: true, error: null });
    await expect(
      readVerifiedYahooIdentity(verified as unknown as SupabaseClient)
    ).resolves.toMatchObject({ userId: "user-1" });
    expect(verified.rpc).toHaveBeenCalledExactlyOnceWith("is_current_session_active");
  });

  it.each([
    { data: false, error: null },
    { data: null, error: null },
    { data: "true", error: null },
    { data: true, error: { code: "PGRST202" } },
  ])("fails closed when the session result is unavailable or invalid: %j", async (result) => {
    await expect(
      readVerifiedYahooIdentity(client(result) as unknown as SupabaseClient)
    ).rejects.toThrow(/no longer active/);
  });

  it("does not hide a transport failure", async () => {
    const failed = client(null);
    failed.rpc.mockRejectedValue(new Error("transport failed"));
    await expect(readVerifiedYahooIdentity(failed as unknown as SupabaseClient)).rejects.toThrow(
      "transport failed"
    );
  });
});
