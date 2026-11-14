// Per-file coverage floor, run after `vitest --coverage` (npm run test:coverage).
// The repo-wide thresholds in vitest.config.ts let one untested file hide behind
// well-tested ones; this check makes every client and server file meet the floor
// on its own. Files below it when the floor arrived are listed as exceptions in
// tests/coverage-floor.json. That list may only shrink: a listed file that now
// meets the floor must come off it, and a file not listed on the base branch
// can't be added. The floor itself can't go below the base branch's.
//
//   node scripts/coverage-floor.mts [base-ref]   base-ref defaults to origin/main
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The coverage measures the floor applies to, as percentages. */
export interface Floor {
  readonly lines: number;
  readonly branches: number;
  readonly functions: number;
}

/** tests/coverage-floor.json: the floor and the files still below it. */
export interface FloorPolicy {
  readonly floor: Floor;
  readonly exceptions: readonly string[];
}

/** One file's coverage, by repository-relative path. */
export interface FileCoverage extends Floor {
  readonly file: string;
}

const MEASURES = ["lines", "branches", "functions"] as const;
const COVERED = /^(client\/src|server)\//;
const POLICY_PATH = "tests/coverage-floor.json";

/** Parses tests/coverage-floor.json, refusing anything but the expected shape. */
export function parsePolicy(text: string): FloorPolicy {
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null) throw new Error("policy is not an object");
  const { floor, exceptions } = value as Record<string, unknown>;
  if (typeof floor !== "object" || floor === null) throw new Error("policy has no floor");
  const measures = floor as Record<string, unknown>;
  for (const measure of MEASURES) {
    if (typeof measures[measure] !== "number") throw new Error(`floor.${measure} is not a number`);
  }
  if (!Array.isArray(exceptions) || !exceptions.every((entry) => typeof entry === "string")) {
    throw new Error("exceptions is not a list of paths");
  }
  return { floor: floor as Floor, exceptions };
}

/** Reads Istanbul's coverage-summary.json into per-file coverage for client and server files. */
export function parseSummary(text: string, root: string): FileCoverage[] {
  const summary = JSON.parse(text) as Record<string, Record<string, { pct: number }>>;
  return Object.entries(summary)
    .filter(([path]) => path !== "total")
    .map(([path, metrics]) => ({
      file: relative(root, path),
      lines: metrics.lines.pct,
      branches: metrics.branches.pct,
      functions: metrics.functions.pct,
    }))
    .filter((coverage) => COVERED.test(coverage.file));
}

function shortfall(coverage: FileCoverage, floor: Floor): string[] {
  return MEASURES.filter((measure) => coverage[measure] < floor[measure]).map(
    (measure) => `${measure} ${coverage[measure]}% < ${floor[measure]}%`
  );
}

/** Every reason the coverage breaks the policy, given the base branch's policy if it has one. */
export function floorProblems(
  coverage: readonly FileCoverage[],
  policy: FloorPolicy,
  base: FloorPolicy | null
): string[] {
  const problems: string[] = [];
  const measured = new Map(coverage.map((entry) => [entry.file, entry]));
  for (const entry of coverage) {
    const below = shortfall(entry, policy.floor);
    const listed = policy.exceptions.includes(entry.file);
    if (below.length > 0 && !listed)
      problems.push(`below floor  ${entry.file}: ${below.join(", ")}`);
    if (below.length === 0 && listed) {
      problems.push(`meets floor  ${entry.file}: remove it from ${POLICY_PATH}`);
    }
  }
  for (const file of policy.exceptions) {
    if (!measured.has(file))
      problems.push(`stale        ${file}: not measured; remove it from ${POLICY_PATH}`);
    if (base && !base.exceptions.includes(file)) {
      problems.push(`new          ${file}: the exception list only shrinks; add tests instead`);
    }
  }
  for (const measure of MEASURES) {
    if (base && policy.floor[measure] < base.floor[measure]) {
      problems.push(
        `lowered      floor.${measure} ${policy.floor[measure]}% < ${base.floor[measure]}% on the base`
      );
    }
  }
  return problems;
}

function basePolicy(root: string, ref: string): FloorPolicy | null {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    throw new Error(`Can't read ${ref}. Fetch it first: git fetch origin main`);
  }
  try {
    const text = execFileSync("git", ["show", `${ref}:${POLICY_PATH}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parsePolicy(text);
  } catch {
    // The base predates the policy file: nothing to compare against yet.
    return null;
  }
}

function main(ref: string): void {
  const root = resolve(import.meta.dirname, "..");
  const policy = parsePolicy(readFileSync(resolve(root, POLICY_PATH), "utf8"));
  const coverage = parseSummary(
    readFileSync(resolve(root, "coverage/coverage-summary.json"), "utf8"),
    root
  );
  let base: FloorPolicy | null;
  try {
    base = basePolicy(root, ref);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  const problems = floorProblems(coverage, policy, base);
  for (const problem of problems) console.error(problem);
  if (problems.length === 0) {
    const { lines, branches, functions } = policy.floor;
    console.log(
      `Every client and server file meets the floor (lines ${lines}%, branches ${branches}%, functions ${functions}%) or is a listed exception (${policy.exceptions.length}).`
    );
  }
  process.exitCode = problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2] ?? "origin/main");
}
