// How the Deploy workflow reaches the production database: its session pooler,
// with TLS, as the postgres user and the database password only. No Supabase
// access token is involved, so nothing here can reach another project.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSchema } from "../config-check/contracts.mts";

/** The production project's session pooler, from its Connect dialog (region us-east-1). */
export const PRODUCTION_POOLER_HOST = "aws-0-us-east-1.pooler.supabase.com";

/** The pooler connection for production, with the password kept separate from the URL. */
export interface ProductionDatabase {
  readonly projectRef: string;
  /** Connection URL without the password, safe to pass on a command line. */
  readonly url: string;
  readonly password: string;
}

/**
 * Production's connection, refusing anything but a Deploy workflow run whose
 * hard-coded project ref matches the repository's hosted contract.
 */
export function productionDatabase(
  root: string,
  env: Readonly<Record<string, string | undefined>>
): ProductionDatabase {
  if (env.GITHUB_ACTIONS !== "true") {
    throw new Error("Production is reached only from the Deploy workflow");
  }
  const contract = contractSchema.parse(
    JSON.parse(readFileSync(join(root, "config/hosted-contract.json"), "utf8"))
  );
  const projectRef = contract.environments.prod.projectRef;
  if (env.SUPABASE_PROJECT_REF !== projectRef) {
    throw new Error("SUPABASE_PROJECT_REF is not the production project");
  }
  const password = env.SUPABASE_DB_PASSWORD ?? "";
  if (!password) throw new Error("SUPABASE_DB_PASSWORD is not set");
  return {
    projectRef,
    url: `postgresql://postgres.${projectRef}@${PRODUCTION_POOLER_HOST}:5432/postgres?sslmode=require`,
    password,
  };
}

/** The same connection with the password in it, for tools that take only a URL. */
export function urlWithPassword(database: ProductionDatabase): string {
  const password = encodeURIComponent(database.password);
  return database.url.replace(
    `postgres.${database.projectRef}@`,
    `postgres.${database.projectRef}:${password}@`
  );
}

/** GitHub Actions workflow commands that hide every form of the password from the log. */
export function maskCommands(database: ProductionDatabase): string[] {
  return [database.password, encodeURIComponent(database.password), urlWithPassword(database)].map(
    (value) => `::add-mask::${value}`
  );
}
