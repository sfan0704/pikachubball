import axios from "axios";
import { env } from "./config/env";
import { logger } from "./utils/logger";

export interface YahooAuthorizationTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  yahooGuid: string;
}

function yahooGuidFromFantasyResponse(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const fantasyContent = (payload as any).fantasy_content;
  const users = fantasyContent?.users;
  const user = users?.["0"]?.user ?? users?.[0]?.user ?? users?.user;
  const attributes = Array.isArray(user) ? user[0] : undefined;
  return typeof attributes?.guid === "string" ? attributes.guid : undefined;
}

async function readYahooGuid(accessToken: string): Promise<string> {
  const response = await axios({
    url: "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1?format=json",
    method: "get",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  const yahooGuid = yahooGuidFromFantasyResponse(response.data);
  if (!yahooGuid) {
    throw new Error("Yahoo Fantasy identity response was incomplete");
  }
  return yahooGuid;
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
      typeof responseYahooGuid === "string"
        ? responseYahooGuid
        : await readYahooGuid(accessToken);

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

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
) {
  if (!clientId || !clientSecret || !env.YAHOO_PROVIDER_REDIRECT_URI) {
    throw new Error("Yahoo refresh configuration is incomplete");
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const response = await axios({
      url: "https://api.login.yahoo.com/oauth2/get_token",
      method: "post",
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

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  } catch (error) {
    logger.error("Yahoo token refresh failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to refresh Yahoo access token");
  }
}
