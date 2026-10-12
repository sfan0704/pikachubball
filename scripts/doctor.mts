// `npm run doctor`: a read-only preflight for a worker. It reports tool
// versions, which integrations this environment can reach, and whether they
// point at this project, with an action for anything missing. It never prints
// tokens, environment values or response bodies, and changes nothing.
// See docs/integration-access.md.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkGitHub,
  checkLinear,
  checkPrivilege,
  checkSupabase,
  checkTools,
  checkVercel,
  healthy,
  type Context,
  type Finding,
} from "./doctor/checks.mts";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");

function realContext(): Context {
  const packageManager: unknown = JSON.parse(
    readFileSync(join(ROOT, "package.json"), "utf8")
  ).packageManager;
  return {
    run: (command, args) => {
      const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: 20_000 });
      return { status: result.error ? null : result.status, stdout: result.stdout ?? "" };
    },
    http: async (url, init) => {
      try {
        const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
        const json: unknown = await response.json().catch(() => undefined);
        return { status: response.status, json };
      } catch {
        return { status: 0, json: undefined };
      }
    },
    env: process.env,
    expectedNode: readFileSync(join(ROOT, ".nvmrc"), "utf8").trim(),
    expectedNpm:
      typeof packageManager === "string" ? packageManager.replace(/^npm@/, "") : "unknown",
    nodeVersion: process.versions.node,
    hasEnvLocal: existsSync(join(ROOT, ".env.local")),
  };
}

function print(findings: readonly Finding[]): void {
  console.log("Doctor (read-only; no secrets shown):");
  for (const finding of findings) {
    console.log(`  ${finding.status.padEnd(11)} ${finding.area.padEnd(18)} ${finding.detail}`);
    if (finding.action && finding.status !== "ok")
      console.log(`  ${"".padEnd(30)}→ ${finding.action}`);
  }
  console.log(healthy(findings) ? "OK to work" : "Not ready: fix the failed or mismatched items");
}

const ctx = realContext();
const findings: Finding[] = [
  ...checkTools(ctx),
  ...(await checkGitHub(ctx)),
  await checkLinear(ctx),
  await checkSupabase(ctx),
  await checkVercel(ctx),
  ...checkPrivilege(ctx),
];
print(findings);
process.exitCode = healthy(findings) ? 0 : 1;
