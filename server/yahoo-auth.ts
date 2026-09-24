import axios from "axios";
import { env } from "./config/env";
import {
  YAHOO_CALL_TIMEOUT_MS,
  providerStatus,
  YahooReconnectRequiredError,
  YahooUnavailableError,
} from "./services/yahoo/yahoo-request-policy";
import { logger } from "./utils/logger";

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
): Promise<YahooAuthorizationTokens> {
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const response = await axios({
      url: "https://api.login.yahoo.com/oauth2/get_token",
      method: "post",
      timeout: YAHOO_CALL_TIMEOUT_MS,
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code,
      }).toString(),
    });

    const accessToken = response.data?.access_token;
    const refreshToken = response.data?.refresh_token;
    const expiresIn = Number(response.data?.expires_in);
    const responseYahooGuid = response.data?.xoauth_yahoo_guid;
    if (
      typeof accessToken !== "string" ||
      typeof refreshToken !== "string" ||
      !Number.isFinite(expiresIn)
    ) {
      throw new Error("Yahoo token response was incomplete");
    }

    const yahooGuid =
      typeof responseYahooGuid === "string" ? responseYahooGuid : undefined;

    return { accessToken, refreshToken, expiresIn, yahooGuid };
  } catch (error) {
    logger.error("Yahoo authorization code exchange failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      status: axios.isAxiosError(error) ? error.response?.status : undefined,
      yahooError: axios.isAxiosError(error) ? error.response?.data?.error : undefined,
      yahooErrorDescription: axios.isAxiosError(error)
        ? error.response?.data?.error_description
        : undefined,
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
): Promise<YahooRefreshedTokens> {
  if (!clientId || !clientSecret || !env.YAHOO_PROVIDER_REDIRECT_URI) {
    throw new Error("Yahoo refresh configuration is incomplete");
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  let data: Record<string, unknown> | undefined;
  try {
    const response = await axios({
      url: "https://api.login.yahoo.com/oauth2/get_token",
      method: "post",
      timeout: YAHOO_CALL_TIMEOUT_MS,
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: new URLSearchParams({
        redirect_uri: env.YAHOO_PROVIDER_REDIRECT_URI,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });
    data = response.data;
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
): Promise<boolean> {
  if (!token || !clientId || !clientSecret) {
    return false;
  }
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    await axios({
      url: "https://api.login.yahoo.com/oauth2/revoke",
      method: "post",
      timeout: YAHOO_CALL_TIMEOUT_MS,
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: new URLSearchParams({
        token,
        token_type_hint: "refresh_token",
      }).toString(),
    });
    return true;
  } catch (error) {
    logger.warn("Yahoo token revocation failed", { status: providerStatus(error) });
    return false;
  }
}
