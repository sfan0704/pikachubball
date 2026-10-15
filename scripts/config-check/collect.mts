import { z } from "zod";
import { snapshotSchema, type Snapshot } from "./contracts.mts";

/** A database metadata reader with an injected transport and read-only requests. */
export async function collectDatabase(
  projectRef: string,
  token: string,
  schemaQuery: string,
  providerQuery: string,
  transport: typeof fetch = fetch
): Promise<Pick<Snapshot, "providers" | "database">> {
  if (!/^[a-z]{20}$/.test(projectRef) || !token) throw new Error("Metadata access unavailable");
  const query = async (sql: string): Promise<unknown> => {
    const response = await transport(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql, read_only: true }),
      }
    );
    if (!response.ok) throw new Error("Metadata access unavailable");
    return response.json();
  };
  const providers = snapshotSchema.shape.providers.unwrap().parse(await query(providerQuery));
  const schemaRows = z
    .array(z.object({ schema_digest: z.string() }).strict())
    .length(1)
    .parse(await query(schemaQuery));
  const migrationRows = z
    .array(z.object({ version: z.string() }).strict())
    .parse(
      await query(
        "select version::text from supabase_migrations.schema_migrations order by version"
      )
    );
  const database = snapshotSchema.shape.database.unwrap().parse({
    migrationVersions: migrationRows.map((row) => row.version),
    schemaDigest: schemaRows[0]?.schema_digest,
  });
  return { providers, database };
}
