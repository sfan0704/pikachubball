import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FantasyMembership,
  OwnerScopedStorage,
  StoredYahooToken,
  YahooConnectionInput,
  YahooTokenInput,
} from "./yahoo-token-storage";
import type { OwnerTokenCipher } from "./owner-token-cipher";
import { AesGcmOwnerTokenCipher } from "./owner-token-cipher";

interface ConnectionRow {
  owner_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  token_expires_at: number | string;
  token_version: number;
}

function storageFailure(operation: string, error: unknown): Error {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "unknown";
  return new Error(`Supabase ${operation} failed (${code})`);
}

export class SupabaseOwnerStorage implements OwnerScopedStorage {
  constructor(
    private readonly client: SupabaseClient,
    private readonly ownerId: string,
    private readonly cipher: OwnerTokenCipher,
  ) {}

  private assertOwner(userId: string): void {
    if (userId !== this.ownerId) {
      throw new Error("Owner-scoped repository rejected a foreign user id");
    }
  }

  private decryptRow(row: ConnectionRow): StoredYahooToken {
    this.assertOwner(row.owner_id);
    return {
      userId: row.owner_id,
      accessToken: this.cipher.decrypt(
        row.owner_id,
        "access",
        row.access_token_ciphertext,
      ),
      refreshToken: this.cipher.decrypt(
        row.owner_id,
        "refresh",
        row.refresh_token_ciphertext,
      ),
      expiresAt: Number(row.token_expires_at),
      version: row.token_version,
    };
  }

  async saveYahooConnection(connection: YahooConnectionInput): Promise<StoredYahooToken> {
    this.assertOwner(connection.userId);
    const accessCiphertext = this.cipher.encrypt(
      this.ownerId,
      "access",
      connection.accessToken,
    );
    const refreshCiphertext = this.cipher.encrypt(
      this.ownerId,
      "refresh",
      connection.refreshToken,
    );
    const { data, error } = await this.client.rpc("upsert_yahoo_connection", {
      p_yahoo_guid: connection.yahooGuid,
      p_display_name: connection.displayName,
      p_email: connection.email,
      p_access_token_ciphertext: accessCiphertext,
      p_refresh_token_ciphertext: refreshCiphertext,
      p_token_expires_at: connection.expiresAt,
      p_encryption_key_version: this.cipher.keyVersion,
    });
    if (error || typeof data !== "number") {
      throw storageFailure("connection upsert", error);
    }
    return { ...connection, version: data };
  }

  async saveYahooToken(
    token: YahooTokenInput,
    options: { expectedVersion?: number } = {},
  ): Promise<StoredYahooToken> {
    this.assertOwner(token.userId);
    if (!Number.isInteger(options.expectedVersion)) {
      throw new Error("Token rotation requires the version that was read");
    }
    const { data, error } = await this.client.rpc("rotate_yahoo_tokens", {
      p_expected_version: options.expectedVersion,
      p_access_token_ciphertext: this.cipher.encrypt(
        this.ownerId,
        "access",
        token.accessToken,
      ),
      p_refresh_token_ciphertext: this.cipher.encrypt(
        this.ownerId,
        "refresh",
        token.refreshToken,
      ),
      p_token_expires_at: token.expiresAt,
      p_encryption_key_version: this.cipher.keyVersion,
    });
    if (error) {
      throw storageFailure("token rotation", error);
    }
    if (data !== true) {
      throw new Error("Yahoo token changed during refresh; stale result rejected");
    }
    return { ...token, version: options.expectedVersion! + 1 };
  }

  async getYahooToken(userId: string): Promise<StoredYahooToken | undefined> {
    this.assertOwner(userId);
    const { data, error } = await this.client
      .from("yahoo_connections")
      .select(
        "owner_id,access_token_ciphertext,refresh_token_ciphertext,token_expires_at,token_version",
      )
      .eq("owner_id", this.ownerId)
      .maybeSingle();
    if (error) {
      throw storageFailure("connection read", error);
    }
    return data ? this.decryptRow(data as ConnectionRow) : undefined;
  }

  async deleteYahooToken(userId: string): Promise<void> {
    this.assertOwner(userId);
    const { error } = await this.client
      .from("yahoo_connections")
      .delete()
      .eq("owner_id", this.ownerId);
    if (error) {
      throw storageFailure("connection delete", error);
    }
  }

  async replaceFantasyMemberships(memberships: FantasyMembership[]): Promise<void> {
    const { error } = await this.client.rpc("replace_fantasy_memberships", {
      p_memberships: memberships.map(({ leagueKey, teamKey }) => ({
        league_key: leagueKey,
        team_key: teamKey,
      })),
    });
    if (error) {
      throw storageFailure("membership replacement", error);
    }
  }

  async ownsFantasyResource(leagueKey: string, teamKey?: string): Promise<boolean> {
    let query = this.client
      .from("fantasy_memberships")
      .select("league_key")
      .eq("owner_id", this.ownerId)
      .eq("league_key", leagueKey);
    if (teamKey) {
      query = query.eq("team_key", teamKey);
    }
    const { data, error } = await query.limit(1);
    if (error) {
      throw storageFailure("membership read", error);
    }
    return Array.isArray(data) && data.length === 1;
  }
}

export function createSupabaseOwnerStorage(
  client: SupabaseClient,
  ownerId: string,
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseOwnerStorage {
  const encryptionKey = environment.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY is required for owner-scoped storage");
  }
  return new SupabaseOwnerStorage(
    client,
    ownerId,
    AesGcmOwnerTokenCipher.fromHex(encryptionKey),
  );
}
