import type { YahooAppConfig } from "../../config/config";
import { logger } from "../../utils/logger";
import { refreshAccessToken } from "./yahoo-auth";
import type { StoredYahooToken, YahooTokenStorage } from "../../storage/yahoo-token-storage";
import { YahooReconnectRequiredError, type YahooRequestClock } from "./yahoo-request-policy";

/** Exchanges a refresh token for new tokens at Yahoo. */
export type TokenRefresher = typeof refreshAccessToken;

interface YahooCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly providerRedirectUri: string | null;
}

/**
 * Holds one user's Yahoo tokens for the length of a request: loaded and
 * decrypted once, refreshed when expired or rejected, and saved with a version
 * check so racing refreshes are settled by storage, not by process state.
 */
export class YahooTokenManager {
  private constructor(
    private current: StoredYahooToken,
    private readonly userId: string,
    private readonly storage: YahooTokenStorage,
    private readonly credentials: YahooCredentials,
    private readonly clock: YahooRequestClock,
    private readonly exchange: TokenRefresher
  ) {}

  /** Loads the user's tokens and refreshes them if already expired. */
  static async load(
    userId: string,
    storage: YahooTokenStorage,
    app: YahooAppConfig,
    clock: YahooRequestClock,
    exchange: TokenRefresher = refreshAccessToken
  ): Promise<YahooTokenManager> {
    if (!app.clientId || !app.clientSecret) {
      throw new Error(
        "Yahoo OAuth credentials are not configured. Please set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET environment variables."
      );
    }
    const stored = await storage.getYahooToken(userId);
    if (!stored) {
      throw new YahooReconnectRequiredError();
    }
    const manager = new YahooTokenManager(
      stored,
      userId,
      storage,
      {
        clientId: app.clientId,
        clientSecret: app.clientSecret,
        providerRedirectUri: app.providerRedirectUri,
      },
      clock,
      exchange
    );
    if (stored.expiresAt <= manager.nowSeconds()) {
      logger.info("Yahoo access token expired, refreshing", { userId });
      await manager.refresh();
    }
    return manager;
  }

  get accessToken(): string {
    return this.current.accessToken;
  }

  /** Replaces the held tokens with fresh ones, or with a newer valid pair another request stored. */
  async refresh(): Promise<void> {
    this.current = await this.exchangeAndStore();
  }

  private nowSeconds(): number {
    return Math.floor(this.clock.now() / 1000);
  }

  private async newerStoredToken(
    expectedVersion: number | undefined
  ): Promise<StoredYahooToken | null> {
    const latest = await this.storage.getYahooToken(this.userId);
    if (
      latest &&
      latest.version !== undefined &&
      expectedVersion !== undefined &&
      latest.version > expectedVersion &&
      latest.expiresAt > this.nowSeconds()
    ) {
      return latest;
    }
    return null;
  }

  private async exchangeAndStore(): Promise<StoredYahooToken> {
    const { refreshToken: currentRefreshToken, version: expectedVersion } = this.current;
    let refreshed;
    try {
      refreshed = await this.exchange(
        currentRefreshToken,
        this.credentials.clientId,
        this.credentials.clientSecret,
        this.credentials.providerRedirectUri
      );
    } catch (error) {
      // Yahoo rejects a refresh token another request already used. If that
      // request stored a newer token, use it instead of asking to reconnect.
      if (error instanceof YahooReconnectRequiredError) {
        const newer = await this.newerStoredToken(expectedVersion);
        if (newer) {
          return newer;
        }
      }
      throw error;
    }
    const rotation = {
      userId: this.userId,
      accessToken: refreshed.accessToken,
      // Yahoo may omit the refresh token; the current one stays valid then.
      refreshToken: refreshed.refreshToken ?? currentRefreshToken,
      expiresAt: this.nowSeconds() + refreshed.expiresIn,
    };

    try {
      return await this.storage.saveYahooToken(rotation, { expectedVersion });
    } catch (error) {
      if (!(error instanceof Error) || !/stale result rejected/.test(error.message)) {
        throw error;
      }
      // Another instance committed a newer token, or the user disconnected.
      // Never write over either: use the committed token or fail closed.
      const newer = await this.newerStoredToken(expectedVersion);
      if (newer) {
        return newer;
      }
      throw new YahooReconnectRequiredError();
    }
  }
}
