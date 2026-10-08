import { ProviderHttpError, requestJson, type FetchFunction } from "./provider-http";
import { z } from "zod";
import {
  YAHOO_CALL_TIMEOUT_MS,
  providerStatus,
  YahooReconnectRequiredError,
  YahooUnavailableError,
} from "./yahoo-request-policy";
import { logger } from "../../utils/logger";

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

const authorizationResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.coerce.number().finite(),
  xoauth_yahoo_guid: z.string().optional(),
});

/** What goes in the log when the code exchange fails: Yahoo's error words, never tokens. */
function exchangeFailureFields(error: unknown) {
  const fromYahoo = error instanceof ProviderHttpError ? error.data : undefined;
  return {
    error: error instanceof Error ? error.message : "Unknown error",
    status: providerStatus(error),
    yahooError: fromYahoo?.error,
    yahooErrorDescription: fromYahoo?.error_description,
  };
}

export async function exchangeAuthorizationCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  fetchFunction: FetchFunction = fetch
): Promise<YahooAuthorizationTokens> {
  try {
    const data = await postForm(
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
    );
    const parsed = authorizationResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("Yahoo token response was incomplete");
    }
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresIn: parsed.data.expires_in,
      yahooGuid: parsed.data.xoauth_yahoo_guid,
    };
  } catch (error) {
    logger.error("Yahoo authorization code exchange failed", exchangeFailureFields(error));
    throw new Error("Failed to exchange Yahoo authorization code");
  }
}

export interface YahooRefreshedTokens {
  accessToken: string;
  /** Present only when Yahoo rotated the refresh token. */
  refreshToken?: string;
  expiresIn: number;
}

const refreshResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.coerce.number().finite(),
});

/** Asks Yahoo for new tokens; a rejected grant means reconnecting, anything else is an outage. */
async function requestRefresh(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  fetchFunction: FetchFunction
): Promise<unknown> {
  try {
    return await postForm(
      TOKEN_URL,
      clientId,
      clientSecret,
      { redirect_uri: redirectUri, grant_type: "refresh_token", refresh_token: refreshToken },
      fetchFunction
    );
  } catch (error) {
    const status = providerStatus(error);
    logger.error("Yahoo token refresh failed", { status });
    throw status === 400 || status === 401
      ? new YahooReconnectRequiredError()
      : new YahooUnavailableError();
  }
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
  const data = await requestRefresh(
    refreshToken,
    clientId,
    clientSecret,
    redirectUri,
    fetchFunction
  );
  const parsed = refreshResponseSchema.safeParse(data);
  if (!parsed.success) {
    logger.error("Yahoo token refresh response was incomplete");
    throw new YahooUnavailableError();
  }
  return {
    accessToken: parsed.data.access_token,
    // Yahoo omits the refresh token when it did not rotate it.
    refreshToken: parsed.data.refresh_token || undefined,
    expiresIn: parsed.data.expires_in,
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
