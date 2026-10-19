// Pull request check: every migration a change adds must sort after the newest
// one on main. `supabase db push` refuses a migration older than production's
// newest, and so does the release drift check, so an out-of-order file would
// only fail after merge.
//
//   node scripts/release/migration-order.mts [base-ref]   base-ref defaults to origin/main
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** A migration this change adds that doesn't sort after the base's newest one. */
export interface OutOfOrderMigration {
  readonly version: string;
  readonly newestOnBase: string;
}

/** The versions in `head` but not in `base` that don't sort after every version in `base`. */
export function outOfOrderMigrations(
  base: readonly string[],
  head: readonly string[]
): OutOfOrderMigration[] {
  const newestOnBase = [...base].sort().at(-1);
  if (newestOnBase === undefined) return [];
  return head
    .filter((version) => !base.includes(version) && version <= newestOnBase)
    .map((version) => ({ version, newestOnBase }));
}

/** The version of each migration file name, as `supabase db push` reads it. */
export function migrationVersions(names: readonly string[]): string[] {
  return names.filter((name) => name.endsWith(".sql")).map((name) => name.split("_")[0]);
}

function baseMigrationNames(root: string, ref: string): string[] {
  const listing = execFileSync("git", ["ls-tree", "--name-only", `${ref}:supabase/migrations`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return listing.split("\n").filter((line) => line !== "");
}

function main(ref: string): void {
  const root = resolve(import.meta.dirname, "../..");
  let baseNames: string[];
  try {
    baseNames = baseMigrationNames(root, ref);
  } catch {
    console.error(
      `Can't read supabase/migrations at ${ref}. Fetch it first: git fetch origin main`
    );
    process.exitCode = 1;
    return;
  }
  const head = migrationVersions(readdirSync(join(root, "supabase", "migrations")));
  const problems = outOfOrderMigrations(migrationVersions(baseNames), head);
  for (const problem of problems) {
    console.error(
      `out of order  ${problem.version} is not after ${problem.newestOnBase}, the newest on ${ref}; rename it with a later timestamp`
    );
  }
  if (problems.length === 0) console.log(`Every added migration sorts after ${ref}'s newest.`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2] ?? "origin/main");
}
