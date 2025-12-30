import type { Request, Response } from "express";
import { env } from "../config/env";
import { generateState, validateState, exchangeCodeForToken } from "../yahoo-auth";
import { extractYahooUserProfile, findOrCreateUserByYahooGuid } from "../services/yahoo/yahoo-social-service";
import { storage } from "../storage";
import { asyncHandler, ValidationError, UnauthorizedError } from "../middleware/error-handler";
import { logger } from "../utils/logger";

/**
 * Validate that Yahoo OAuth credentials are configured
 * Throws if credentials are missing
 */
function validateYahooCredentials(): { clientId: string; clientSecret: string } {
  if (!env.YAHOO_CLIENT_ID || !env.YAHOO_CLIENT_SECRET) {
    throw new ValidationError(
      'Yahoo Social Login is not configured. Please set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET environment variables.'
    );
  }
  return {
    clientId: env.YAHOO_CLIENT_ID,
    clientSecret: env.YAHOO_CLIENT_SECRET,
  };
}

/**
 * Yahoo Social Login controller
 * Handles Yahoo OAuth for user authentication (not just API access)
 */
export const yahooSocialController = {
  /**
   * Initiate Yahoo OAuth login flow
   * Redirects user to Yahoo for authentication
   */
  initiateLogin: asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = validateYahooCredentials();
    const state = generateState();
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: env.YAHOO_REDIRECT_URI || getDefaultRedirectUri(),
      response_type: 'code',
      state: state,
      scope: 'openid fspt-r',
    });
    
    const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`;
    
    logger.info('Initiating Yahoo social login', {
      stateLength: state.length,
    });
    
    res.redirect(authUrl);
  }),

  /**
   * Handle Yahoo OAuth callback
   * Exchanges code for tokens, fetches user profile, creates/finds user, logs them in
   */
  handleCallback: asyncHandler(async (req: Request, res: Response) => {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors from Yahoo
    if (error) {
      logger.error('Yahoo OAuth error', { error, error_description });
      throw new ValidationError(`Yahoo authentication failed: ${error_description || error}`);
    }

    // Validate required parameters
    if (!code || typeof code !== 'string') {
      throw new ValidationError('Missing authorization code');
    }

    if (!state || typeof state !== 'string') {
      throw new ValidationError('Missing state parameter');
    }

    // Validate state for CSRF protection
    if (!validateState(state)) {
      throw new UnauthorizedError('Invalid or expired state parameter');
    }

    // Validate credentials and exchange code for tokens
    const { clientId, clientSecret } = validateYahooCredentials();
    const tokens = await exchangeCodeForToken(
      code,
      clientId,
      clientSecret
    );

    // Validate that we received an id_token (required when 'openid' scope is used)
    if (!tokens.idToken) {
      logger.error('Yahoo OAuth response missing id_token', {
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken,
      });
      throw new ValidationError(
        'Yahoo did not return an id_token. Please ensure the "openid" scope is configured for your app.'
      );
    }

    // Extract user profile from the id_token
    const profile = extractYahooUserProfile(tokens.idToken);
    
    // Get or create user from Yahoo profile
    const { user } = await findOrCreateUserByYahooGuid(profile);

    // Store the OAuth tokens for this user (for Yahoo Fantasy API access)
    // expiresAt is stored as Unix timestamp (seconds since epoch)
    await storage.saveYahooToken({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expiresIn,
    });

    // Log the user in via Passport session
    await new Promise<void>((resolve, reject) => {
      req.login(user, (err) => {
        if (err) {
          logger.error('Failed to login user after Yahoo OAuth', { error: err, userId: user.id });
          reject(new Error('Failed to complete login'));
        } else {
          resolve();
        }
      });
    });

    logger.info('Yahoo social login successful', {
      userId: user.id,
      username: user.username,
      isNewUser: !user.createdAt || (Date.now() - user.createdAt.getTime()) < 5000,
    });

    // Redirect to the app (frontend will handle the authenticated state)
    res.redirect('/');
  }),
};

/**
 * Get default redirect URI based on environment
 */
function getDefaultRedirectUri(): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/yahoo/callback`;
  }
  return `http://localhost:${env.PORT}/api/auth/yahoo/callback`;
}

