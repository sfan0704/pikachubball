import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { allPassed, compare } from "./compare.mts";
import { baselineSchema, contractSchema, snapshotSchema } from "./contracts.mts";
import { repositoryInputs } from "./repository.mts";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

try {
  const [, , snapshotPath, baselinePath] = process.argv;
  if (!snapshotPath) throw new Error("missing snapshot");
  const root = resolve(import.meta.dirname, "../..");
  const snapshot = snapshotSchema.parse(readJson(snapshotPath));
  const baseline = baselinePath ? baselineSchema.parse(readJson(baselinePath)) : null;
  const contract = contractSchema.parse(readJson(`${root}/config/hosted-contract.json`));
  const results = compare(snapshot, baseline, contract, {
    ...repositoryInputs(root),
    now: new Date(),
  });
  const report = results.map((r) => `${r.outcome.padEnd(11)} ${r.check}`).join("\n");
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Configuration checks\n\n\`\`\`text\n${report}\n\`\`\`\n`
    );
  }
  process.exitCode = allPassed(results) ? 0 : 1;
} catch {
  // Parse errors may contain untrusted input, including accidental credentials.
  console.error(
    "Configuration evidence is unavailable or invalid. Use the documented metadata-only input format."
  );
  process.exitCode = 1;
}
