// The release drift check: before a release migrates production, production's
// schema must be exactly what replaying the migrations it records produces.
// scripts/release/drift-check.sh runs it; this file holds the comparison, kept
// free of Docker and the network so tests can drive it.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { workspaceConfig, type Workspace } from "../workspace.mts";

/** What a database records about itself: applied migration versions and its public-schema digest. */
export const databaseStateSchema = z
  .object({
    migrationVersions: z.array(z.string().regex(/^\d+$/)),
    schemaDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

/** A parsed database state; it holds no rows, values or credentials. */
export type DatabaseState = z.infer<typeof databaseStateSchema>;

/** Runs one read-only statement and returns its first column, one string per row. */
export type ReadOnlyQuery = (sql: string) => Promise<string[]>;

/** One drift criterion's outcome, never echoing what was observed. */
export interface DriftResult {
  readonly check: string;
  readonly outcome: "passed" | "mismatch";
}

/** Reads the recorded migrations and the schema digest; a database with no history records none. */
export async function readDatabaseState(
  query: ReadOnlyQuery,
  schemaQuery: string
): Promise<DatabaseState> {
  const [hasHistory] = await query(
    "select to_regclass('supabase_migrations.schema_migrations') is not null"
  );
  const migrationVersions =
    hasHistory === "t" || hasHistory === "true"
      ? await query(
          "select version::text from supabase_migrations.schema_migrations order by version"
        )
      : [];
  const digests = await query(schemaQuery);
  if (digests.length !== 1) throw new Error("The schema query must return one digest");
  return databaseStateSchema.parse({ migrationVersions, schemaDigest: digests[0] });
}

/**
 * The repository migrations to replay for what production records, or null
 * when production records anything but the first of them, in order.
 */
export function replayVersions(
  recorded: readonly string[],
  repository: readonly string[]
): readonly string[] | null {
  const prefix = repository.slice(0, recorded.length);
  return recorded.length <= repository.length && recorded.every((v, i) => v === prefix[i])
    ? prefix
    : null;
}

/** Compares production with the replay of its own recorded migrations. */
export function compareWithReplay(
  production: DatabaseState,
  replay: DatabaseState,
  repository: readonly string[]
): DriftResult[] {
  const versions = replayVersions(production.migrationVersions, repository);
  const sameHistory =
    versions !== null && JSON.stringify(versions) === JSON.stringify(replay.migrationVersions);
  return [
    {
      check: "recorded migrations are this checkout's",
      outcome: sameHistory ? "passed" : "mismatch",
    },
    {
      check: "schema matches the replay of those migrations",
      outcome:
        sameHistory && production.schemaDigest === replay.schemaDigest ? "passed" : "mismatch",
    },
  ];
}

/** Only an observation where every criterion matched lets the release go on. */
export function driftPassed(results: readonly DriftResult[]): boolean {
  return results.length > 0 && results.every((r) => r.outcome === "passed");
}

/**
 * Writes a Supabase folder for this workspace's own stack whose migrations are
 * only the given versions, so `db reset` from it rebuilds what production records.
 */
export function writeReplayStack(
  ws: Workspace,
  versions: readonly string[],
  migrationFiles: readonly string[]
): string {
  const workdir = join(ws.workdir, "replay");
  const target = join(workdir, "supabase");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(join(target, "migrations"), { recursive: true });
  const tracked = readFileSync(join(ws.root, "supabase", "config.toml"), "utf8");
  writeFileSync(join(target, "config.toml"), workspaceConfig(ws, tracked));
  const wanted = new Set(versions);
  const chosen = migrationFiles.filter((name) => wanted.has(name.split("_")[0] ?? ""));
  if (chosen.length !== wanted.size) throw new Error("A recorded migration has no file");
  for (const name of chosen) {
    copyFileSync(join(ws.root, "supabase", "migrations", name), join(target, "migrations", name));
  }
  return workdir;
}
