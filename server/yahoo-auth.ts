import axios from "axios";
import { randomBytes } from "crypto";
import { env } from "./config/env";
import { logger } from "./utils/logger";

// Build redirect URI dynamically based on environment
function getRedirectUri(): string {
  // Allow custom redirect URI for development (e.g., ngrok HTTPS URL)
  if (env.YAHOO_REDIRECT_URI) {
    return env.YAHOO_REDIRECT_URI;
  }
  if (env.REPLIT_DEV_DOMAIN) {
    return `https://${env.REPLIT_DEV_DOMAIN}/api/auth/yahoo/callback`;
  }
  // Use the PORT from env (defaults to 5000, but can be overridden)
  // Try HTTPS first since Yahoo requires it, fallback to HTTP
  const port = env.PORT;
  // Yahoo requires HTTPS, so use https://localhost even though it may show a warning
  return `https://localhost:${port}/api/auth/yahoo/callback`;
}

const REDIRECT_URI = getRedirectUri();

// In-memory state store for CSRF protection
const stateStore = new Map<string, { expires: number }>();

// Cleanup expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  const expiredStates: string[] = [];
  
  stateStore.forEach((data, state) => {
    if (data.expires < now) {
      expiredStates.push(state);
    }
  });
  
  expiredStates.forEach(state => stateStore.delete(state));
}, 5 * 60 * 1000);

export function generateState(): string {
  const state = randomBytes(32).toString('hex');
  stateStore.set(state, { expires: Date.now() + 10 * 60 * 1000 }); // 10 min expiry
  return state;
}

export function validateState(state: string): boolean {
  const data = stateStore.get(state);
  if (!data || data.expires < Date.now()) {
    return false;
  }
  stateStore.delete(state);
  return true;
}

export function getAuthorizationUrl(state: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state: state
  });
  
  // Use fspt-r scope for read-only access to Yahoo Fantasy Sports
  // This is sufficient for analyzing data and providing recommendations
  params.append('scope', 'fspt-r');
  
  // Note: Removed 'language' parameter as it may not be standard for Yahoo OAuth
  
  const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`;
  
  // Log the full URL for debugging (without exposing sensitive data)
  logger.debug('Generated Yahoo OAuth URL', {
    endpoint: 'https://api.login.yahoo.com/oauth2/request_auth',
    redirectUri: REDIRECT_URI,
    clientIdPrefix: clientId.substring(0, 20) + '...',
    stateLength: state.length,
    scope: 'fspt-r',
    urlLength: authUrl.length,
  });
  
  return authUrl;
}

export async function exchangeCodeForToken(code: string, clientId: string, clientSecret: string) {
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const requestData = {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    code: code,
    grant_type: 'authorization_code'
  };

  logger.debug('Exchanging code for token', {
    redirectUri: REDIRECT_URI,
    codeLength: code.length,
    clientIdPrefix: clientId.substring(0, 10),
  });

  try {
    const response = await axios({
      url: 'https://api.login.yahoo.com/oauth2/get_token',
      method: 'post',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams(requestData).toString()
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in
    };
  } catch (error: any) {
    // Log detailed error information
    logger.error('Error exchanging code for token:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      requestUrl: error.config?.url,
      requestData: {
        ...requestData,
        code: code.substring(0, 10) + '...',
        client_secret: '***',
      },
      message: error.message,
    });

    // Provide more detailed error message
    const errorMessage = error.response?.data?.error_description 
      || error.response?.data?.error
      || error.message
      || 'Failed to exchange authorization code for token';
    
    throw new Error(`Token exchange failed: ${errorMessage}`);
  }
}

export async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  // Require credentials to be provided (no fallback)
  if (!clientId || !clientSecret) {
    throw new Error('Yahoo OAuth credentials are required');
  }
  
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
    const response = await axios({
      url: 'https://api.login.yahoo.com/oauth2/get_token',
      method: 'post',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        redirect_uri: REDIRECT_URI,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }).toString()
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    logger.error('Error refreshing token:', error);
    throw new Error('Failed to refresh access token');
  }
}

// Note: Token refresh is handled by YahooApiClient in yahoo-api-client.ts
// API calls are made directly to Yahoo Fantasy API
