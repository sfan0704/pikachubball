import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { baselineSchema } from "../../scripts/config-check/contracts.mts";
import { database } from "./local-stack";

const query = readFileSync("scripts/config-check/schema.sql", "utf8");
async function fingerprint(): Promise<string> {
  const { rows } = await database.query<{ schema_digest: unknown }>(query);
  return baselineSchema.shape.schemaDigest.parse(rows[0]?.schema_digest);
}

beforeAll(() => database.connect());
afterAll(() => database.end());

describe("metadata-only schema fingerprint", () => {
  it.each([
    "alter table public.user_leagues add column drift_test integer",
    "alter table public.user_leagues disable row level security",
    "alter policy user_leagues_owner_select on public.user_leagues using (true)",
    "grant select on public.user_leagues to anon",
    "alter table public.yahoo_connections disable trigger yahoo_connections_verified_guid",
    "create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin return new; end; $$",
    "alter table public.user_leagues add constraint drift_test check (season > 2000)",
    "create table public.drift_test (id integer)",
  ])("detects a seeded catalog mismatch: %s", async (change) => {
    const before = await fingerprint();
    await database.query("begin");
    try {
      await database.query(change);
      expect(await fingerprint()).not.toBe(before);
    } finally {
      await database.query("rollback");
    }
    expect(await fingerprint()).toBe(before);
  });
});
