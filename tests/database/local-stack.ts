// Shared setup for the local-tier database suites. See scripts/test-database.sh:
// SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY drive the clients under test, and
// SUPABASE_DB_URL only seeds the Yahoo identity that sign-in would normally
// create, because the local stack cannot reach Yahoo.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { AesGcmOwnerTokenCipher } from "../../server/storage/owner-token-cipher";
import { SupabaseOwnerStorage } from "../../server/storage/supabase-owner-storage";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";

if (
  !/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl) ||
  !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):/.test(databaseUrl)
) {
  throw new Error("Local database tests only run against a local Supabase stack");
}

export const database = new pg.Client({ connectionString: databaseUrl });

export const cipher = AesGcmOwnerTokenCipher.fromHex("22".repeat(32));

export interface Owner {
  id: string;
  yahooGuid: string;
  client: SupabaseClient;
  storage: SupabaseOwnerStorage;
}

export function newClient(): SupabaseClient {
  return createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// `db reset` restarts the API containers; wait until PostgREST accepts sessions
// and surface its full error if it never does.
async function waitForDataApi(client: SupabaseClient): Promise<void> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const { error } = await client.from("yahoo_connections").select("owner_id").limit(0);
    if (!error) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Data API rejected a fresh session: ${error.code} ${error.message} ${error.details ?? ""}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

export async function signUpOwner(label: string): Promise<Owner> {
  const client = newClient();
  const { data, error } = await client.auth.signUp({
    email: `${label}-${randomUUID()}@example.test`,
    password: randomUUID(),
  });
  if (error || !data.user || !data.session) {
    throw new Error(`Could not create synthetic ${label} session: ${error?.message}`);
  }
  const yahooGuid = `guid-${label}-${randomUUID()}`;
  await database.query(
    `insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
     values ($1, $2, $3, 'custom:yahoo', now(), now())`,
    [
      yahooGuid,
      data.user.id,
      { sub: yahooGuid, iss: "https://api.login.yahoo.com" },
    ],
  );
  await waitForDataApi(client);
  return {
    id: data.user.id,
    yahooGuid,
    client,
    storage: new SupabaseOwnerStorage(client, data.user.id, cipher),
  };
}

export async function connect(owner: Owner, label: string) {
  return owner.storage.saveYahooConnection({
    userId: owner.id,
    yahooGuid: owner.yahooGuid,
    displayName: `Manager ${label}`,
    email: `${label}@example.test`,
    accessToken: `access-secret-${label}`,
    refreshToken: `refresh-secret-${label}`,
    expiresAt: 1_800_000_000,
  });
}

