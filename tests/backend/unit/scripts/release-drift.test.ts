import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compareWithReplay,
  driftPassed,
  readDatabaseState,
  replayVersions,
  writeReplayStack,
  type DatabaseState,
  type ReadOnlyQuery,
} from "../../../../scripts/release/drift.mts";
import {
  maskCommands,
  productionDatabase,
  urlWithPassword,
} from "../../../../scripts/release/production-database.mts";
import { workspace } from "../../../../scripts/workspace.mts";

const repository = ["20261019000000", "20261101000000"];
const digestA = "a".repeat(64);
const digestB = "b".repeat(64);

function state(migrationVersions: string[], schemaDigest = digestA): DatabaseState {
  return { migrationVersions, schemaDigest };
}

describe("which migrations to replay", () => {
  it("replays the repository migrations production records, in order", () => {
    expect(replayVersions(["20261019000000"], repository)).toEqual(["20261019000000"]);
    expect(replayVersions(repository, repository)).toEqual(repository);
  });

  it("replays nothing for a production database with no history yet", () => {
    expect(replayVersions([], repository)).toEqual([]);
  });

  it("refuses a history this checkout doesn't have, or has out of order", () => {
    expect(replayVersions(["202609120001"], repository)).toBeNull();
    expect(replayVersions(["20261101000000"], repository)).toBeNull();
    expect(replayVersions([...repository, "20261201000000"], repository)).toBeNull();
  });
});

describe("production against its replay", () => {
  it("passes when history and schema both match", () => {
    const results = compareWithReplay(
      state(["20261019000000"]),
      state(["20261019000000"]),
      repository
    );
    expect(driftPassed(results)).toBe(true);
  });

  it("stops on a schema that differs from the replay", () => {
    const results = compareWithReplay(
      state(["20261019000000"]),
      state(["20261019000000"], digestB),
      repository
    );
    expect(results).toEqual([
      { check: "recorded migrations are this checkout's", outcome: "passed" },
      { check: "schema matches the replay of those migrations", outcome: "mismatch" },
    ]);
    expect(driftPassed(results)).toBe(false);
  });

  it("stops on an unknown history even when the digests agree", () => {
    const results = compareWithReplay(state(["202609120001"]), state([]), repository);
    expect(results.every((r) => r.outcome === "mismatch")).toBe(true);
  });

  it("stops when the replay rebuilt other migrations than production records", () => {
    const results = compareWithReplay(state([]), state(["20261019000000"]), repository);
    expect(driftPassed(results)).toBe(false);
  });

  it("never passes an empty set of results", () => {
    expect(driftPassed([])).toBe(false);
  });
});

describe("reading a database's state", () => {
  function fake(answers: Record<string, string[]>): { query: ReadOnlyQuery; asked: string[] } {
    const asked: string[] = [];
    return {
      asked,
      query: async (sql) => {
        asked.push(sql);
        const answer = Object.entries(answers).find(([prefix]) => sql.startsWith(prefix));
        if (!answer) throw new Error(`unexpected query ${sql}`);
        return answer[1];
      },
    };
  }

  it("reads recorded versions and the digest", async () => {
    const { query } = fake({
      "select to_regclass": ["t"],
      "select version": ["20261019000000"],
      "select fingerprint": [digestA],
    });
    expect(await readDatabaseState(query, "select fingerprint")).toEqual(state(["20261019000000"]));
  });

  it("treats a database without a history table as recording no migrations", async () => {
    const { query, asked } = fake({ "select to_regclass": ["f"], "select fingerprint": [digestA] });
    expect(await readDatabaseState(query, "select fingerprint")).toEqual(state([]));
    expect(asked.some((sql) => sql.startsWith("select version"))).toBe(false);
  });

  it("rejects anything but exactly one digest", async () => {
    const { query } = fake({ "select to_regclass": ["f"], "select fingerprint": [] });
    await expect(readDatabaseState(query, "select fingerprint")).rejects.toThrow("one digest");
  });
});

describe("the replay stack", () => {
  let root = "";
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("holds this workspace's config and only the recorded migrations", () => {
    root = mkdtempSync(join(tmpdir(), "replay-"));
    mkdirSync(join(root, "supabase", "migrations"), { recursive: true });
    writeFileSync(join(root, "supabase", "config.toml"), 'project_id = "pikachubball"\n');
    for (const name of ["20261019000000_baseline.sql", "20261101000000_next.sql"]) {
      writeFileSync(join(root, "supabase", "migrations", name), `-- ${name}\n`);
    }
    const ws = workspace(root);
    const workdir = writeReplayStack(
      ws,
      ["20261019000000"],
      ["20261019000000_baseline.sql", "20261101000000_next.sql"]
    );
    expect(readdirSync(join(workdir, "supabase", "migrations"))).toEqual([
      "20261019000000_baseline.sql",
    ]);
    expect(readFileSync(join(workdir, "supabase", "config.toml"), "utf8")).toContain(
      `project_id = "${ws.projectId}"`
    );
  });

  it("refuses a recorded version with no migration file", () => {
    root = mkdtempSync(join(tmpdir(), "replay-"));
    mkdirSync(join(root, "supabase"), { recursive: true });
    writeFileSync(join(root, "supabase", "config.toml"), 'project_id = "pikachubball"\n');
    expect(() => writeReplayStack(workspace(root), ["20261019000000"], [])).toThrow("no file");
  });
});

describe("the production connection", () => {
  const repo = resolve(".");
  const env = {
    GITHUB_ACTIONS: "true",
    SUPABASE_PROJECT_REF: "fpdwtpwpmxsbgjxizuxa",
    SUPABASE_DB_PASSWORD: "synthetic p@ss/word",
  };

  it("uses the session pooler with TLS and keeps the password out of the URL", () => {
    const database = productionDatabase(repo, env);
    expect(database.url).toBe(
      "postgresql://postgres.fpdwtpwpmxsbgjxizuxa@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
    );
    expect(database.url).not.toContain("synthetic");
    expect(urlWithPassword(database)).toContain(
      "postgres.fpdwtpwpmxsbgjxizuxa:synthetic%20p%40ss%2Fword@"
    );
  });

  it("masks every form of the password", () => {
    const masks = maskCommands(productionDatabase(repo, env));
    expect(masks).toEqual([
      "::add-mask::synthetic p@ss/word",
      "::add-mask::synthetic%20p%40ss%2Fword",
      `::add-mask::${urlWithPassword(productionDatabase(repo, env))}`,
    ]);
  });

  it.each([
    [{ ...env, GITHUB_ACTIONS: undefined }, "only from the Deploy workflow"],
    [{ ...env, SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst" }, "not the production project"],
    [{ ...env, SUPABASE_DB_PASSWORD: "" }, "SUPABASE_DB_PASSWORD is not set"],
  ])("refuses to connect outside a production release: %#", (badEnv, message) => {
    expect(() => productionDatabase(repo, badEnv)).toThrow(message);
  });
});
