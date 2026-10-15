import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Digest one exact catalog response or repository input; no normalization hides drift. */
export function digest(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Bind a schema reference to the ordered migration bytes and catalog query it came from. */
export function repositoryInputs(root: string) {
  const folder = join(root, "supabase/migrations");
  const names = readdirSync(folder)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const query = readFileSync(join(root, "scripts/config-check/schema.sql"), "utf8");
  return {
    migrationVersions: names.map((name) => name.split("_")[0]),
    migrationsDigest: digest(
      names.map((name) => `${name}\0${readFileSync(join(folder, name), "utf8")}\0`).join("")
    ),
    queryDigest: digest(query),
    query,
  };
}
