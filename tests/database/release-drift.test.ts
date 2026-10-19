import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { repositoryInputs } from "../../scripts/config-check/repository.mts";
import {
  compareWithReplay,
  driftPassed,
  readDatabaseState,
  type ReadOnlyQuery,
} from "../../scripts/release/drift.mts";
import { database } from "./local-stack";

// test-database.sh has just rebuilt this database from every committed
// migration, so it stands in for both production and its replay.
const inputs = repositoryInputs(".");
const query: ReadOnlyQuery = async (sql) => {
  const { rows } = await database.query<unknown[]>({ text: sql, rowMode: "array" });
  return rows.map((row) => String(row[0]));
};

beforeAll(() => database.connect());
afterAll(() => database.end());

describe("release drift check against a migration-built schema", () => {
  it("records every committed migration", async () => {
    const state = await readDatabaseState(query, inputs.query);
    expect(state.migrationVersions).toEqual(inputs.migrationVersions);
  });

  it("passes when production matches the replay of its recorded migrations", async () => {
    const replay = await readDatabaseState(query, inputs.query);
    const production = await readDatabaseState(query, inputs.query);
    expect(driftPassed(compareWithReplay(production, replay, inputs.migrationVersions))).toBe(true);
  });

  it.each([
    "grant select on public.user_leagues to anon",
    "grant execute on function public.touch_updated_at() to authenticated",
    "alter table public.user_preferences no force row level security",
    "create function public.drift_test() returns integer language sql as 'select 1'",
  ])("stops the release when production was altered: %s", async (change) => {
    const replay = await readDatabaseState(query, inputs.query);
    await database.query("begin");
    try {
      await database.query(change);
      const production = await readDatabaseState(query, inputs.query);
      const results = compareWithReplay(production, replay, inputs.migrationVersions);
      expect(results).toContainEqual({
        check: "schema matches the replay of those migrations",
        outcome: "mismatch",
      });
      expect(driftPassed(results)).toBe(false);
    } finally {
      await database.query("rollback");
    }
  });

  it("ignores the platform's own event-trigger function in public", async () => {
    const before = await readDatabaseState(query, inputs.query);
    await database.query("begin");
    try {
      // A stand-in for the function hosted projects create when "automatic RLS" is on.
      await database.query(
        "create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin end; $$"
      );
      expect((await readDatabaseState(query, inputs.query)).schemaDigest).toBe(before.schemaDigest);
    } finally {
      await database.query("rollback");
    }
  });
});
