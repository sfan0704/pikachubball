// The Deploy workflow's configuration checks read production's sign-in
// providers through the database password it already holds, not a Supabase
// access token. Kept free of Docker and the network so tests can drive it.
import { snapshotSchema, type Snapshot } from "../config-check/contracts.mts";
import type { ReadOnlyQuery } from "./drift.mts";

/** Runs the provider projection as one JSON row; no rows is an empty list, not a failure to read. */
export async function readProviders(
  query: ReadOnlyQuery,
  providerQuery: string
): Promise<NonNullable<Snapshot["providers"]>> {
  const projection = providerQuery.trim().replace(/;$/, "");
  const rows = await query(
    `select coalesce(jsonb_agg(p), '[]'::jsonb)::text from (\n${projection}\n) p`
  );
  if (rows.length !== 1) throw new Error("The provider query must return one row");
  return snapshotSchema.shape.providers.unwrap().parse(JSON.parse(rows[0] ?? ""));
}
