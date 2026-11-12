import type { Preferences } from "../../shared/api/account";
import type { UserLeague, UserLeagueInput } from "../../shared/api/leagues";

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
    options?: { expectedVersion?: number }
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

/** What a request's opening database call proves about the signed-in caller. */
export interface RequestAccess {
  /** The `sub` of the caller's Yahoo sign-in identity. */
  readonly yahooGuid: string;
  readonly displayName: string | null;
}

export interface OwnerScopedStorage extends YahooTokenStorage {
  /**
   * Opens a request in one round trip: confirms the signed session is still
   * live and is a Yahoo sign-in, and reads ahead the league check and Yahoo
   * tokens the request is likely to need. Throws when the session is not live.
   */
  openRequest(leagueKey: string | null): Promise<RequestAccess>;
  saveYahooConnection(connection: YahooConnectionInput): Promise<StoredYahooToken>;
  replaceFantasyMemberships(memberships: FantasyMembership[]): Promise<void>;
  ownsFantasyResource(leagueKey: string, teamKey?: string): Promise<boolean>;
  /** Deletes the user's Yahoo tokens and stored leagues in one transaction. */
  disconnectYahoo(): Promise<void>;
  /** Deletes the signed-in user's account and everything stored for it. */
  deleteAccount(): Promise<void>;
  /** The user's saved choices; empty choices when none were ever saved. */
  getPreferences(): Promise<Preferences>;
  savePreferences(preferences: Preferences): Promise<void>;
  /** The user's stored leagues, newest season first. */
  listUserLeagues(): Promise<UserLeague[]>;
  /** Replaces all of the user's stored leagues in one transaction. */
  replaceUserLeagues(leagues: readonly UserLeagueInput[]): Promise<void>;
  /** Whether the league is in the user's stored leagues (`user_leagues`). */
  ownsLeague(leagueKey: string): Promise<boolean>;
}
