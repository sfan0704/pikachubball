import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { database, newClient, signUpOwner } from "./local-stack";
import { readVerifiedYahooIdentity } from "../../server/http/auth/supabase-auth";

beforeAll(async () => {
  await database.connect();
});
afterAll(async () => {
  await database.end();
});

describe("active session against real local Supabase Auth and PostgREST", () => {
  it("rejects a copied, unexpired access JWT after local logout", async () => {
    const owner = await signUpOwner("session-replay");
    const {
      data: { session },
    } = await owner.client.auth.getSession();
    if (!session) throw new Error("Synthetic signup has no session");
    // Fixed authorization preserves the copied JWT even if getUser clears SDK state.
    const bearerReplay = newClient(session.access_token);
    const replay = newClient();
    const { error: restoreError } = await replay.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    expect(restoreError).toBeNull();
    await expect(readVerifiedYahooIdentity(replay)).resolves.toMatchObject({ userId: owner.id });
    expect((await owner.client.auth.signOut({ scope: "local" })).error).toBeNull();
    const claims = JSON.parse(
      Buffer.from(session.access_token.split(".")[1], "base64url").toString()
    );
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000);
    const rows = await database.query(
      "select count(*)::int as count from auth.sessions where id = $1",
      [claims.session_id]
    );
    expect(rows.rows[0].count).toBe(0);
    await expect(readVerifiedYahooIdentity(replay)).rejects.toThrow();
    const result = await bearerReplay.rpc("is_current_session_active");
    expect(result.error).toBeNull();
    expect(result.data).toBe(false);
  });

  it("denies anonymous RPC access", async () => {
    const result = await newClient().rpc("is_current_session_active");
    expect(result.error?.code).toBe("42501");
  });
});
