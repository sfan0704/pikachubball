import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { baselineSchema } from "./contracts.mts";
import { repositoryInputs } from "./repository.mts";
import { workspace } from "../workspace.mts";

try {
  const output = process.argv[2];
  if (!output) throw new Error("missing destination");
  const root = resolve(import.meta.dirname, "../..");
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (dirty) throw new Error("A clean checkout is required");
  // Never trust an existing database as the expectation: replay the committed migrations first.
  execFileSync("npm", ["run", "test:db"], { cwd: root, stdio: "inherit", timeout: 1_200_000 });
  const input = repositoryInputs(root);
  const schemaDigest = execFileSync(
    "docker",
    [
      "exec",
      `supabase_db_${workspace(root).projectId}`,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      input.query,
    ],
    { encoding: "utf8", timeout: 30_000 }
  ).trim();
  const baseline = baselineSchema.parse({
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    migrationsDigest: input.migrationsDigest,
    queryDigest: input.queryDigest,
    schemaDigest,
  });
  writeFileSync(output, JSON.stringify(baseline, null, 2) + "\n", { mode: 0o600 });
  console.log("Migration-built schema baseline saved.");
} catch {
  console.error(
    "Schema baseline unavailable: use a clean checkout on a supported Docker worker and an output path."
  );
  process.exitCode = 1;
}
