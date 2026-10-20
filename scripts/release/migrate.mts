// Release step: apply the committed migrations to production through its
// session pooler with the database password only (scripts/release/production-database.mts).
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { maskCommands, productionDatabase, urlWithPassword } from "./production-database.mts";

try {
  const database = productionDatabase(resolve(import.meta.dirname, "../.."), process.env);
  for (const command of maskCommands(database)) console.log(command);
  const result = spawnSync("supabase", ["db", "push", "--db-url", urlWithPassword(database)], {
    stdio: "inherit",
  });
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(`Migration could not start: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
