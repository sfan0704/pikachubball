import axios from "axios";
import { env } from "./config/env";
import { logger } from "./utils/logger";

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
