// The steps of scripts/release/drift-check.sh:
//
//   node scripts/release/drift-cli.mts read-production <state.json>  production's recorded state
//   node scripts/release/drift-cli.mts replay <state.json>           prints a workdir holding only those migrations
//   node scripts/release/drift-cli.mts compare <state.json>          the local replay against production
//
// Every query runs in a read-only transaction. Nothing printed holds a row,
// a value or a credential: only check names and outcomes.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { repositoryInputs } from "../config-check/repository.mts";
import { workspace } from "../workspace.mts";
import {
  compareWithReplay,
  databaseStateSchema,
  driftPassed,
  readDatabaseState,
  replayVersions,
  writeReplayStack,
  type DatabaseState,
  type ReadOnlyQuery,
} from "./drift.mts";
import { productionDatabase } from "./production-database.mts";

// The production database runs Postgres 17; its client reads the catalog the same way.
const POSTGRES_IMAGE = "postgres:17";
const root = resolve(import.meta.dirname, "../..");

function psql(
  before: readonly string[],
  after: readonly string[],
  env?: NodeJS.ProcessEnv
): ReadOnlyQuery {
  return async (sql) => {
    const output = execFileSync(
      "docker",
      [
        ...before,
        "psql",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "begin transaction read only",
        "-c",
        sql,
        "-c",
        "commit",
        ...after,
      ],
      { encoding: "utf8", timeout: 120_000, env, stdio: ["ignore", "pipe", "inherit"] }
    );
    return output.split("\n").filter((line) => line !== "");
  };
}

function readState(path: string): DatabaseState {
  return databaseStateSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

async function readProduction(output: string): Promise<void> {
  const database = productionDatabase(root, process.env);
  // The password goes to the container through the environment, never as an argument.
  const query = psql(["run", "--rm", "-e", "PGPASSWORD", POSTGRES_IMAGE], [database.url], {
    ...process.env,
    PGPASSWORD: database.password,
  });
  const state = await readDatabaseState(query, repositoryInputs(root).query);
  writeFileSync(output, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  console.log(`Production records ${state.migrationVersions.length} migrations.`);
}

function replay(statePath: string): void {
  const production = readState(statePath);
  const versions = replayVersions(
    production.migrationVersions,
    repositoryInputs(root).migrationVersions
  );
  if (versions === null) {
    console.error("mismatch    recorded migrations are this checkout's");
    process.exitCode = 1;
    return;
  }
  const files = readdirSync(join(root, "supabase", "migrations")).filter((n) => n.endsWith(".sql"));
  console.log(writeReplayStack(workspace(root), versions, files));
}

async function compare(statePath: string): Promise<void> {
  const production = readState(statePath);
  const inputs = repositoryInputs(root);
  const local = psql(
    ["exec", `supabase_db_${workspace(root).projectId}`],
    ["-U", "postgres", "-d", "postgres"]
  );
  const results = compareWithReplay(
    production,
    await readDatabaseState(local, inputs.query),
    inputs.migrationVersions
  );
  const report = results.map((r) => `${r.outcome.padEnd(11)} ${r.check}`).join("\n");
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Production drift check\n\n\`\`\`text\n${report}\n\`\`\`\n`
    );
  }
  process.exitCode = driftPassed(results) ? 0 : 1;
}

const [, , step, path] = process.argv;
try {
  if (!path) throw new Error("missing state file");
  if (step === "read-production") await readProduction(path);
  else if (step === "replay") replay(path);
  else if (step === "compare") await compare(path);
  else throw new Error(`unknown step ${step}`);
} catch (error) {
  // Messages here are this script's own; psql's errors went straight to stderr.
  console.error(`Drift check could not run: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
