// The one validation contract for people, agents and CI: `npm run validate`.
// With no profile it runs `review`: everything CI requires before a merge.
// CI's jobs call the same profiles. Any failed check, or one that couldn't run
// because Docker or Chromium is missing, makes the result fail.
//
//   npm run validate                      review: every required check
//   npm run validate -- static unit       named profiles, in order
//   npm run validate -- iterate           a fast subset while working; never enough for review
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The checks, by the name used in reports. */
export type CheckName =
  | "lint"
  | "format"
  | "knip"
  | "types"
  | "unit"
  | "quick"
  | "build"
  | "bundle"
  | "database"
  | "browser";

/** One check: the npm script CI runs and what it needs first. */
interface Check {
  readonly script: string;
  readonly env?: Readonly<Record<string, string>>;
  /** Another check that must pass first. */
  readonly after?: CheckName;
  readonly needs?: readonly Prerequisite[];
}

type Prerequisite = "docker" | "chromium";

// A synthetic 32-byte key, the same CI used; never a real environment's key.
const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const CHECKS: Readonly<Record<CheckName, Check>> = {
  lint: { script: "lint" },
  format: { script: "format:check" },
  knip: { script: "knip" },
  types: { script: "check" },
  unit: { script: "test:coverage", env: { NODE_ENV: "test", ENCRYPTION_KEY: TEST_KEY } },
  quick: { script: "test" },
  build: { script: "build", env: { NODE_ENV: "production", ENCRYPTION_KEY: TEST_KEY } },
  bundle: { script: "check:bundle", after: "build" },
  database: { script: "test:db", needs: ["docker"] },
  browser: { script: "test:browser", after: "build", needs: ["docker", "chromium"] },
};

/** Named groups of checks. `review` is what a change needs before review; `iterate` is not enough. */
export const PROFILES: Readonly<Record<string, readonly CheckName[]>> = {
  static: ["lint", "format", "knip", "types"],
  unit: ["unit"],
  build: ["build", "bundle"],
  database: ["database"],
  browser: ["build", "browser"],
  review: ["lint", "format", "knip", "types", "unit", "build", "bundle", "database", "browser"],
  iterate: ["lint", "types", "quick"],
};

/** The checks the profiles ask for, in order, each once. Unknown profiles are an error. */
export function resolveChecks(profiles: readonly string[]): CheckName[] {
  const names = profiles.length > 0 ? profiles : ["review"];
  const checks: CheckName[] = [];
  for (const name of names) {
    const group = PROFILES[name];
    if (!group) {
      throw new Error(`Unknown profile "${name}". Profiles: ${Object.keys(PROFILES).join(", ")}`);
    }
    for (const check of group) if (!checks.includes(check)) checks.push(check);
  }
  return checks;
}

export type Outcome = "passed" | "failed" | "unavailable" | "not run";

export interface Result {
  readonly check: CheckName;
  readonly outcome: Outcome;
  readonly detail: string;
  readonly seconds: number;
}

/** Whether the run as a whole passed: only if every check ran and passed. */
export function passed(results: readonly Result[]): boolean {
  return results.length > 0 && results.every((result) => result.outcome === "passed");
}

function missing(prerequisite: Prerequisite): string | undefined {
  if (prerequisite === "docker") {
    const docker = spawnSync("docker", ["info"], { stdio: "ignore", timeout: 20_000 });
    return docker.status === 0 ? undefined : "Docker isn't running";
  }
  // A locally installed Chrome (PW_CHANNEL=chrome) stands in for Playwright's Chromium.
  if (process.env.PW_CHANNEL) return undefined;
  try {
    const { chromium } = createRequire(import.meta.url)("playwright") as {
      chromium: { executablePath(): string };
    };
    return existsSync(chromium.executablePath())
      ? undefined
      : "Chromium isn't installed (npx playwright install --with-deps chromium)";
  } catch {
    return "Playwright isn't installed (npm ci)";
  }
}

function run(name: CheckName, earlier: readonly Result[]): Result {
  const check = CHECKS[name];
  const before = check.after && earlier.find((result) => result.check === check.after);
  if (check.after && before?.outcome !== "passed") {
    return { check: name, outcome: "not run", detail: `needs ${check.after} to pass`, seconds: 0 };
  }
  const absent = (check.needs ?? []).map(missing).find(Boolean);
  if (absent) return { check: name, outcome: "unavailable", detail: absent, seconds: 0 };
  console.log(`\n▶ ${name}: npm run ${check.script}`);
  const started = Date.now();
  const result = spawnSync("npm", ["run", check.script], {
    stdio: "inherit",
    env: { ...process.env, ...check.env },
  });
  const seconds = Math.round((Date.now() - started) / 1000);
  return result.status === 0
    ? { check: name, outcome: "passed", detail: `npm run ${check.script}`, seconds }
    : { check: name, outcome: "failed", detail: `npm run ${check.script}`, seconds };
}

function report(results: readonly Result[], profiles: readonly string[]): void {
  console.log(`\nValidation (${profiles.length > 0 ? profiles.join(" ") : "review"}):`);
  for (const result of results) {
    console.log(
      `  ${result.outcome.padEnd(11)} ${result.check.padEnd(9)} ${String(result.seconds).padStart(4)}s  ${result.detail}`
    );
  }
  if (profiles.includes("iterate")) {
    console.log("  iterate is for working; run `npm run validate` before asking for review.");
  }
  console.log(passed(results) ? "PASSED" : "FAILED");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const profiles = process.argv.slice(2);
  const results: Result[] = [];
  for (const check of resolveChecks(profiles)) results.push(run(check, results));
  report(results, profiles);
  process.exitCode = passed(results) ? 0 : 1;
}
