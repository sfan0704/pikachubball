export interface YahooTokenInput {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface StoredYahooToken extends YahooTokenInput {
  version?: number;
}

export interface YahooTokenStorage {
  saveYahooToken(
    token: YahooTokenInput,
    options?: { expectedVersion?: number },
  ): Promise<StoredYahooToken>;
  getYahooToken(userId: string): Promise<StoredYahooToken | undefined>;
  deleteYahooToken(userId: string): Promise<void>;
}

export interface YahooConnectionInput extends YahooTokenInput {
  yahooGuid: string;
  displayName: string | null;
  email: string | null;
}

export interface FantasyMembership {
  leagueKey: string;
  teamKey: string;
}

export interface OwnerScopedStorage extends YahooTokenStorage {
  saveYahooConnection(connection: YahooConnectionInput): Promise<StoredYahooToken>;
  replaceFantasyMemberships(memberships: FantasyMembership[]): Promise<void>;
  ownsFantasyResource(leagueKey: string, teamKey?: string): Promise<boolean>;
}
