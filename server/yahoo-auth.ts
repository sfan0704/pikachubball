import axios from "axios";
import { storage } from "./storage";
import { randomBytes } from "crypto";

const CLIENT_ID = process.env.YAHOO_CLIENT_ID!;
const CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET!;
const REDIRECT_URI = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/yahoo/callback`
  : "http://localhost:5000/api/auth/yahoo/callback";

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
    language: 'en-us',
    state: state
  });
  
  // Add the fspt-w scope for read/write access to Yahoo Fantasy Sports
  // Use fspt-r for read-only access if write operations are not needed
  params.append('scope', 'fspt-w');
  
  return `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, clientId: string, clientSecret: string) {
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
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        code: code,
        grant_type: 'authorization_code'
      }).toString()
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    throw new Error('Failed to exchange authorization code for token');
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  
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
    console.error('Error refreshing token:', error);
    throw new Error('Failed to refresh access token');
  }
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const tokenData = await storage.getYahooToken(userId);
  
  if (!tokenData) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  
  if (tokenData.expiresAt > now + 300) {
    return tokenData.accessToken;
  }

  try {
    const newTokens = await refreshAccessToken(tokenData.refreshToken);
    
    await storage.saveYahooToken({
      userId: userId,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresAt: now + newTokens.expiresIn
    });

    return newTokens.accessToken;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    await storage.deleteYahooToken(userId);
    return null;
  }
}

export class YahooAuthError extends Error {
  constructor(message: string, public readonly needsReauth: boolean = false) {
    super(message);
    this.name = 'YahooAuthError';
  }
}

export async function makeYahooApiRequest(userId: string, endpoint: string, params?: Record<string, string>) {
  const accessToken = await getValidAccessToken(userId);
  
  if (!accessToken) {
    throw new YahooAuthError('No valid Yahoo access token available. Please reconnect your Yahoo account.', true);
  }

  const url = new URL(`https://fantasysports.yahooapis.com/fantasy/v2${endpoint}`);
  url.searchParams.append('format', 'json');
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  try {
    const response = await axios({
      url: url.toString(),
      method: 'get',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      await storage.deleteYahooToken(userId);
      throw new YahooAuthError('Yahoo token is invalid or expired. Please reconnect your Yahoo account.', true);
    }
    
    console.error('Error making Yahoo API request:', error);
    throw new Error('Failed to fetch data from Yahoo Fantasy API');
  }
}
