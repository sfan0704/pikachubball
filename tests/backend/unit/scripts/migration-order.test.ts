import { describe, expect, it } from "vitest";
import {
  migrationVersions,
  outOfOrderMigrations,
} from "../../../../scripts/release/migration-order.mts";

const main = ["20261019000000", "20261101000000"];

describe("migration order check", () => {
  it("passes a migration with a later timestamp than main's newest", () => {
    expect(outOfOrderMigrations(main, [...main, "20261102000000"])).toEqual([]);
  });

  it("fails a migration with an earlier timestamp than main's newest", () => {
    expect(outOfOrderMigrations(main, [...main, "20261020000000"])).toEqual([
      { version: "20261020000000", newestOnBase: "20261101000000" },
    ]);
  });

  it("passes a change that adds no migration, and any migration when main has none", () => {
    expect(outOfOrderMigrations(main, main)).toEqual([]);
    expect(outOfOrderMigrations([], ["20261019000000"])).toEqual([]);
  });

  it("reads versions from migration file names the way supabase db push does", () => {
    expect(migrationVersions(["20261019000000_baseline.sql", "README.md"])).toEqual([
      "20261019000000",
    ]);
  });
});
