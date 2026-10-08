import { ProviderHttpError, requestJson, type FetchFunction } from "./services/yahoo/provider-http";
import {
  YAHOO_CALL_TIMEOUT_MS,
  providerStatus,
  YahooReconnectRequiredError,
  YahooUnavailableError,
} from "./services/yahoo/yahoo-request-policy";
import { logger } from "./utils/logger";

const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

/** Posts a form to a Yahoo OAuth endpoint with the app's credentials as Basic auth. */
function postForm(
  url: string,
  clientId: string,
  clientSecret: string,
  form: Record<string, string>,
  fetchFunction: FetchFunction
): Promise<unknown> {
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return requestJson(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form).toString(),
    },
    YAHOO_CALL_TIMEOUT_MS,
    fetchFunction
  );
}

export interface YahooAuthorizationTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  yahooGuid?: string;
}

export async function exchangeAuthorizationCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  fetchFunction: FetchFunction = fetch
): Promise<YahooAuthorizationTokens> {
  try {
    const data = (await postForm(
      TOKEN_URL,
      clientId,
      clientSecret,
      {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code,
      },
      fetchFunction
    )) as Record<string, unknown>;

    const accessToken = data?.access_token;
    const refreshToken = data?.refresh_token;
    const expiresIn = Number(data?.expires_in);
    const responseYahooGuid = data?.xoauth_yahoo_guid;
    if (
      typeof accessToken !== "string" ||
      typeof refreshToken !== "string" ||
      !Number.isFinite(expiresIn)
    ) {
      throw new Error("Yahoo token response was incomplete");
    }

    const yahooGuid = typeof responseYahooGuid === "string" ? responseYahooGuid : undefined;

    return { accessToken, refreshToken, expiresIn, yahooGuid };
  } catch (error) {
    logger.error("Yahoo authorization code exchange failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      status: providerStatus(error),
      yahooError: error instanceof ProviderHttpError ? error.data?.error : undefined,
      yahooErrorDescription:
        error instanceof ProviderHttpError ? error.data?.error_description : undefined,
    });
    throw new Error("Failed to exchange Yahoo authorization code");
  }
}

export interface YahooRefreshedTokens {
  accessToken: string;
  /** Present only when Yahoo rotated the refresh token. */
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Exchanges a refresh token once, within the per-call timeout. A rejected
 * grant means the user must reconnect; anything else is a provider outage.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string | null,
  fetchFunction: FetchFunction = fetch
): Promise<YahooRefreshedTokens> {
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Yahoo refresh configuration is incomplete");
  }

  let data: Record<string, unknown> | undefined;
  try {
    data = (await postForm(
      TOKEN_URL,
      clientId,
      clientSecret,
      { redirect_uri: redirectUri, grant_type: "refresh_token", refresh_token: refreshToken },
      fetchFunction
    )) as Record<string, unknown>;
  } catch (error) {
    const status = providerStatus(error);
    logger.error("Yahoo token refresh failed", { status });
    if (status === 400 || status === 401) {
      throw new YahooReconnectRequiredError();
    }
    throw new YahooUnavailableError();
  }

  const accessToken = data?.access_token;
  const rotatedRefreshToken = data?.refresh_token;
  const expiresIn = Number(data?.expires_in);
  if (typeof accessToken !== "string" || !accessToken || !Number.isFinite(expiresIn)) {
    logger.error("Yahoo token refresh response was incomplete");
    throw new YahooUnavailableError();
  }

  return {
    accessToken,
    refreshToken:
      typeof rotatedRefreshToken === "string" && rotatedRefreshToken
        ? rotatedRefreshToken
        : undefined,
    expiresIn,
  };
}

/**
 * Revokes a Yahoo token at the provider (RFC 7009 endpoint from Yahoo's
 * discovery document). Returns whether Yahoo confirmed it; never throws, so a
 * provider failure cannot keep local tokens from being deleted.
 */
export async function revokeYahooToken(
  token: string,
  clientId: string,
  clientSecret: string,
  fetchFunction: FetchFunction = fetch
): Promise<boolean> {
  if (!token || !clientId || !clientSecret) {
    return false;
  }

  try {
    await postForm(
      "https://api.login.yahoo.com/oauth2/revoke",
      clientId,
      clientSecret,
      { token, token_type_hint: "refresh_token" },
      fetchFunction
    );
    return true;
  } catch (error) {
    logger.warn("Yahoo token revocation failed", { status: providerStatus(error) });
    return false;
  }
}
