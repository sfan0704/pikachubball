// Seeds the throwaway local Supabase stack with two synthetic managers who are
// signed in to Yahoo and belong to the recorded league. Refuses anything but
// loopback addresses. Run through `npm run dev`, which supplies the environment.
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { SEED_LEAGUE_KEY, SEED_USERS } from "../server/dev/seed-users";
import { AesGcmOwnerTokenCipher } from "../server/storage/owner-token-cipher";
import { SupabaseOwnerStorage } from "../server/storage/supabase-owner-storage";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const databaseUrl = process.env.SUPABASE_DB_URL ?? "";
const encryptionKey = process.env.ENCRYPTION_KEY ?? "";

if (
  !/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl) ||
  !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):/.test(databaseUrl)
) {
  throw new Error("The seed only runs against a local Supabase stack");
}

async function main(): Promise<void> {
  const database = new pg.Client({ connectionString: databaseUrl });
  await database.connect();
  const cipher = AesGcmOwnerTokenCipher.fromHex(encryptionKey);

  for (const manager of SEED_USERS) {
    const client = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signUp({
      email: manager.email,
      password: manager.password,
    });
    if (error || !data.user || !data.session) {
      throw new Error(`Could not create ${manager.email}: ${error?.message}`);
    }
    // Sign-in through Yahoo would create this identity; the local stack can't reach Yahoo.
    await database.query(
      `insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
       values ($1, $2, $3, 'custom:yahoo', now(), now())`,
      [
        manager.yahooGuid,
        data.user.id,
        { sub: manager.yahooGuid, iss: "https://api.login.yahoo.com", name: manager.displayName },
      ]
    );
    const storage = new SupabaseOwnerStorage(client, data.user.id, cipher);
    await storage.saveYahooConnection({
      userId: data.user.id,
      yahooGuid: manager.yahooGuid,
      displayName: manager.displayName,
      email: null,
      accessToken: `local-access-${manager.key}`,
      refreshToken: `local-refresh-${manager.key}`,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    await storage.replaceUserLeagues([
      {
        leagueKey: SEED_LEAGUE_KEY,
        teamKey: manager.teamKey,
        name: "Test League",
        season: 2025,
        isFinished: false,
      },
    ]);
    console.log(`Seeded ${manager.email} (${manager.teamKey})`);
  }
  await database.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
