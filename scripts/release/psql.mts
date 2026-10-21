// psql through Docker, for the Deploy workflow's read-only checks against
// production and this checkout's own disposable stack.
import { execFileSync } from "node:child_process";
import type { ReadOnlyQuery } from "./drift.mts";
import { productionDatabase } from "./production-database.mts";

// The production database runs Postgres 17; its client reads the catalog the same way.
const POSTGRES_IMAGE = "postgres:17";

/** Runs each statement in its own read-only transaction through `docker <before> psql ... <after>`. */
export function psql(
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

/** Read-only queries against production through its session pooler. */
export function productionQuery(root: string, env: NodeJS.ProcessEnv): ReadOnlyQuery {
  const database = productionDatabase(root, env);
  // The password goes to the container through the environment, never as an argument.
  return psql(["run", "--rm", "-e", "PGPASSWORD", POSTGRES_IMAGE], [database.url], {
    ...env,
    PGPASSWORD: database.password,
  });
}
