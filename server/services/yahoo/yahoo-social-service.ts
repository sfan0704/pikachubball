/**
 * Yahoo Social Login Service
 * HTTP-agnostic service for handling Yahoo OAuth user identity and account management
 */

import { storage } from "../../storage";
import { logger } from "../../utils/logger";
import type { User } from "@shared/schema";

/**
 * Yahoo user profile extracted from the id_token
 */
export interface YahooUserProfile {
  sub: string;  // Yahoo GUID (unique identifier)
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}

/**
 * Decode the id_token JWT to extract user profile
 * Note: We don't verify the signature since we received the token directly from Yahoo
 * over HTTPS during the OAuth token exchange
 */
export function decodeIdToken(idToken: string): YahooUserProfile {
  try {
    // JWT has 3 parts: header.payload.signature
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Decode the payload (second part)
    const payload = parts[1];
    // Handle URL-safe base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    const decoded = JSON.parse(jsonPayload);

    // Validate that we got a GUID (required field)
    if (!decoded.sub) {
      throw new Error("Yahoo id_token missing required 'sub' (GUID) field");
    }

    logger.debug("Decoded Yahoo id_token", {
      guid: decoded.sub,
      hasEmail: !!decoded.email,
      hasName: !!decoded.name,
    });

    return {
      sub: decoded.sub,
      name: decoded.name,
      given_name: decoded.given_name,
      family_name: decoded.family_name,
      email: decoded.email,
      email_verified: decoded.email_verified,
      picture: decoded.picture,
    };
  } catch (error: any) {
    logger.error("Failed to decode Yahoo id_token", {
      message: error.message,
    });
    throw new Error(`Failed to decode Yahoo id_token: ${error.message}`);
  }
}

/**
 * Extract Yahoo user profile from id_token
 * The id_token is a JWT returned by Yahoo when the 'openid' scope is requested
 */
export function extractYahooUserProfile(idToken: string): YahooUserProfile {
  return decodeIdToken(idToken);
}

/**
 * Generate a unique username from Yahoo profile
 * Uses email prefix or creates one from GUID
 */
function generateUsername(profile: YahooUserProfile): string {
  if (profile.email) {
    // Use email prefix (before @)
    const emailPrefix = profile.email.split("@")[0];
    // Sanitize: only allow alphanumeric and underscores
    const sanitized = emailPrefix.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    return `yahoo_${sanitized}`;
  }
  
  // Fallback to GUID-based username
  return `yahoo_${profile.sub.substring(0, 12).toLowerCase()}`;
}

/**
 * Generate display name from Yahoo profile
 */
function generateDisplayName(profile: YahooUserProfile): string | null {
  if (profile.name) {
    return profile.name;
  }
  
  if (profile.given_name || profile.family_name) {
    return [profile.given_name, profile.family_name].filter(Boolean).join(" ");
  }
  
  return null;
}

/**
 * Find an existing user by Yahoo GUID, or create a new one
 * Returns the user and whether they were newly created
 */
export async function findOrCreateUserByYahooGuid(
  profile: YahooUserProfile
): Promise<{ user: User; isNewUser: boolean }> {
  const yahooGuid = profile.sub;

  // First, try to find existing user by Yahoo GUID
  const existingUser = await storage.getUserByYahooGuid(yahooGuid);
  
  if (existingUser) {
    logger.info("Found existing user by Yahoo GUID", {
      userId: existingUser.id,
      yahooGuid,
    });
    return { user: existingUser, isNewUser: false };
  }

  // Generate username and display name from profile
  let username = generateUsername(profile);
  const displayName = generateDisplayName(profile);
  const email = profile.email || null;

  // Ensure username is unique (append random suffix if needed)
  let existingUsername = await storage.getUserByUsername(username);
  let attempts = 0;
  while (existingUsername && attempts < 10) {
    const suffix = Math.random().toString(36).substring(2, 6);
    username = `${username}_${suffix}`;
    existingUsername = await storage.getUserByUsername(username);
    attempts++;
  }

  if (existingUsername) {
    throw new Error("Failed to generate unique username after multiple attempts");
  }

  // Create new OAuth user
  const newUser = await storage.createOAuthUser({
    username,
    yahooGuid,
    displayName,
    email,
  });

  logger.info("Created new user via Yahoo OAuth", {
    userId: newUser.id,
    username: newUser.username,
    yahooGuid,
  });

  return { user: newUser, isNewUser: true };
}

/**
 * Complete Yahoo social login flow:
 * 1. Extract user profile from id_token
 * 2. Find or create user in database
 * 3. Return user for session creation
 */
export async function completeYahooSocialLogin(
  idToken: string
): Promise<{ user: User; isNewUser: boolean }> {
  // Extract profile from id_token
  const profile = extractYahooUserProfile(idToken);
  
  // Find or create user
  const result = await findOrCreateUserByYahooGuid(profile);
  
  return result;
}

