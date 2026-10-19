import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectDatabase } from "./collect.mts";
import { contractSchema, snapshotSchema, type Snapshot } from "./contracts.mts";
import { repositoryInputs } from "./repository.mts";

try {
  const [, , environment, output, authFile, vercelFile] = process.argv;
  if (environment !== "prod" || !output) throw new Error("Invalid arguments");
  const root = resolve(import.meta.dirname, "../..");
  const contract = contractSchema.parse(
    JSON.parse(readFileSync(`${root}/config/hosted-contract.json`, "utf8"))
  );
  const projectRef = contract.environments[environment].projectRef;
  const auth = authFile
    ? snapshotSchema.shape.auth.unwrap().parse(JSON.parse(readFileSync(authFile, "utf8")))
    : null;
  const vercel = vercelFile
    ? snapshotSchema.shape.vercel.unwrap().parse(JSON.parse(readFileSync(vercelFile, "utf8")))
    : null;
  let database: Pick<Snapshot, "providers" | "database"> = { providers: null, database: null };
  const token = process.env.CONFIG_SUPABASE_ACCESS_TOKEN;
  if (token) {
    database = await collectDatabase(
      projectRef,
      token,
      repositoryInputs(root).query,
      readFileSync(`${root}/scripts/config-check/providers.sql`, "utf8")
    );
  }
  const snapshot = snapshotSchema.parse({
    environment,
    capturedAt: new Date().toISOString(),
    projectRef,
    auth,
    vercel,
    ...database,
  });
  writeFileSync(output, JSON.stringify(snapshot, null, 2) + "\n", { mode: 0o600 });
  console.log("Metadata snapshot saved; missing sources remain unavailable.");
  process.exitCode = token && auth !== null && vercel !== null ? 0 : 1;
} catch {
  console.error(
    "Metadata capture failed. Check scoped access and the documented non-secret projection files."
  );
  process.exitCode = 1;
}
