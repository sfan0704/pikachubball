// The Deploy workflow's configuration checks, after the smoke check: the Yahoo
// sign-in provider and the Vercel variables against config/hosted-contract.json
// (docs/runbooks/configuration-checks.md). Reads production in a read-only
// transaction and Vercel with decryption off. Prints only check names and outcomes.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { allPassed, compareAfterDeploy } from "../config-check/compare.mts";
import { contractSchema, snapshotSchema } from "../config-check/contracts.mts";
import { printReport } from "../config-check/report.mts";
import { collectVercel } from "../config-check/vercel.mts";
import { readProviders } from "./config.mts";
import { productionQuery } from "./psql.mts";

const root = resolve(import.meta.dirname, "../..");

try {
  const contract = contractSchema.parse(
    JSON.parse(readFileSync(`${root}/config/hosted-contract.json`, "utf8"))
  );
  const providers = await readProviders(
    productionQuery(root, process.env),
    readFileSync(`${root}/scripts/config-check/providers.sql`, "utf8")
  );
  const vercel = await collectVercel(contract, process.env.VERCEL_TOKEN ?? "");
  const snapshot = snapshotSchema.parse({
    environment: "prod",
    capturedAt: new Date().toISOString(),
    projectRef: contract.environments.prod.projectRef,
    providers,
    auth: null,
    database: null,
    vercel,
  });
  const results = compareAfterDeploy(snapshot, contract, new Date());
  printReport("Configuration checks", results);
  process.exitCode = allPassed(results) ? 0 : 1;
} catch {
  // Parse and platform errors can echo what was read; say only that it failed.
  console.error("Configuration checks could not read production's metadata.");
  process.exitCode = 1;
}
