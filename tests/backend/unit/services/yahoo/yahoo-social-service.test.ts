import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  decodeIdToken,
  extractYahooUserProfile,
  findOrCreateUserByYahooGuid,
  completeYahooSocialLogin,
  type YahooUserProfile,
} from '../../../../../server/services/yahoo/yahoo-social-service';
import { storage } from '../../../../../server/storage';
import { createMockOAuthUser } from '../../../fixtures/test-helpers';

// Mock dependencies
vi.mock('../../../../../server/storage');
vi.mock('../../../../../server/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

/**
 * Helper to create a mock JWT id_token for testing
 * JWT format: header.payload.signature (all base64 encoded)
 */
function createMockIdToken(payload: Record<string, unknown>): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'mock-signature'; // Signature is not validated in our implementation
  return `${headerB64}.${payloadB64}.${signature}`;
}

describe('yahoo-social-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('decodeIdToken', () => {
    it('should decode a valid JWT and extract user profile', () => {
      // ARRANGE
      const payload = {
        sub: 'YAHOO_GUID_ABC123',
        name: 'Test User',
        email: 'testuser@yahoo.com',
        email_verified: true,
      };
      const idToken = createMockIdToken(payload);

      // ACT
      const result = decodeIdToken(idToken);

      // ASSERT
      expect(result.sub).toBe('YAHOO_GUID_ABC123');
      expect(result.name).toBe('Test User');
      expect(result.email).toBe('testuser@yahoo.com');
      expect(result.email_verified).toBe(true);
    });

    it('should throw error for invalid JWT format (not 3 parts)', () => {
      // ARRANGE
      const invalidToken = 'not.a.valid.jwt.token';

      // ACT & ASSERT
      expect(() => decodeIdToken(invalidToken)).toThrow('Invalid JWT format');
    });

    it('should throw error if sub (GUID) is missing', () => {
      // ARRANGE
      const payload = {
        name: 'Test User',
        email: 'test@yahoo.com',
        // Missing 'sub' field
      };
      const idToken = createMockIdToken(payload);

      // ACT & ASSERT
      expect(() => decodeIdToken(idToken)).toThrow(
        "Yahoo id_token missing required 'sub' (GUID) field"
      );
    });

    it('should handle token with minimal payload (only sub)', () => {
      // ARRANGE
      const payload = { sub: 'MINIMAL_GUID' };
      const idToken = createMockIdToken(payload);

      // ACT
      const result = decodeIdToken(idToken);

      // ASSERT
      expect(result.sub).toBe('MINIMAL_GUID');
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();
    });
  });

  describe('extractYahooUserProfile', () => {
    it('should extract profile from id_token', () => {
      // ARRANGE
      const payload = {
        sub: 'EXTRACT_GUID',
        given_name: 'John',
        family_name: 'Doe',
      };
      const idToken = createMockIdToken(payload);

      // ACT
      const result = extractYahooUserProfile(idToken);

      // ASSERT
      expect(result.sub).toBe('EXTRACT_GUID');
      expect(result.given_name).toBe('John');
      expect(result.family_name).toBe('Doe');
    });
  });

  describe('findOrCreateUserByYahooGuid', () => {
    it('should return existing user if found by Yahoo GUID', async () => {
      // ARRANGE
      const profile: YahooUserProfile = {
        sub: 'YAHOO_GUID_EXISTING',
        name: 'Existing User',
        email: 'existing@yahoo.com',
      };
      const existingUser = createMockOAuthUser({
        yahooGuid: 'YAHOO_GUID_EXISTING',
      });

      vi.mocked(storage.getUserByYahooGuid).mockResolvedValue(existingUser);

      // ACT
      const result = await findOrCreateUserByYahooGuid(profile);

      // ASSERT
      expect(storage.getUserByYahooGuid).toHaveBeenCalledWith('YAHOO_GUID_EXISTING');
      expect(storage.createOAuthUser).not.toHaveBeenCalled();
      expect(result.user).toEqual(existingUser);
      expect(result.isNewUser).toBe(false);
    });

    it('should create new user if not found by Yahoo GUID', async () => {
      // ARRANGE
      const profile: YahooUserProfile = {
        sub: 'YAHOO_GUID_NEW',
        name: 'New User',
        email: 'newuser@yahoo.com',
      };
      const newUser = createMockOAuthUser({
        id: 'new-user-id',
        username: 'yahoo_newuser',
        yahooGuid: 'YAHOO_GUID_NEW',
        displayName: 'New User',
        email: 'newuser@yahoo.com',
      });

      vi.mocked(storage.getUserByYahooGuid).mockResolvedValue(undefined);
      vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);
      vi.mocked(storage.createOAuthUser).mockResolvedValue(newUser);

      // ACT
      const result = await findOrCreateUserByYahooGuid(profile);

      // ASSERT
      expect(storage.getUserByYahooGuid).toHaveBeenCalledWith('YAHOO_GUID_NEW');
      expect(storage.createOAuthUser).toHaveBeenCalledWith({
        username: 'yahoo_newuser',
        yahooGuid: 'YAHOO_GUID_NEW',
        displayName: 'New User',
        email: 'newuser@yahoo.com',
      });
      expect(result.user).toEqual(newUser);
      expect(result.isNewUser).toBe(true);
    });

    it('should generate unique username if email-based username exists', async () => {
      // ARRANGE
      const profile: YahooUserProfile = {
        sub: 'YAHOO_GUID_DUPLICATE',
        email: 'duplicate@yahoo.com',
      };
      const existingUserWithSameUsername = createMockOAuthUser({
        username: 'yahoo_duplicate',
      });
      const newUser = createMockOAuthUser({
        username: 'yahoo_duplicate_abc1',
        yahooGuid: 'YAHOO_GUID_DUPLICATE',
      });

      vi.mocked(storage.getUserByYahooGuid).mockResolvedValue(undefined);
      // First call returns existing user, second returns undefined (unique found)
      vi.mocked(storage.getUserByUsername)
        .mockResolvedValueOnce(existingUserWithSameUsername)
        .mockResolvedValueOnce(undefined);
      vi.mocked(storage.createOAuthUser).mockResolvedValue(newUser);

      // ACT
      const result = await findOrCreateUserByYahooGuid(profile);

      // ASSERT
      expect(storage.getUserByUsername).toHaveBeenCalledTimes(2);
      expect(storage.createOAuthUser).toHaveBeenCalled();
      expect(result.isNewUser).toBe(true);
    });

    it('should use GUID-based username if no email provided', async () => {
      // ARRANGE
      const profile: YahooUserProfile = {
        sub: 'ABCDEFGHIJKLMNOP',  // 16 char GUID
        name: 'User Without Email',
      };
      const newUser = createMockOAuthUser({
        username: 'yahoo_abcdefghijkl',  // First 12 chars of GUID
        yahooGuid: 'ABCDEFGHIJKLMNOP',
      });

      vi.mocked(storage.getUserByYahooGuid).mockResolvedValue(undefined);
      vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);
      vi.mocked(storage.createOAuthUser).mockResolvedValue(newUser);

      // ACT
      const result = await findOrCreateUserByYahooGuid(profile);

      // ASSERT
      expect(storage.createOAuthUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: expect.stringMatching(/^yahoo_abcdefghijkl$/i),
          yahooGuid: 'ABCDEFGHIJKLMNOP',
          displayName: 'User Without Email',
          email: null,
        })
      );
      expect(result.isNewUser).toBe(true);
    });

    it('should handle display name from given_name and family_name', async () => {
      // ARRANGE
      const profile: YahooUserProfile = {
        sub: 'YAHOO_GUID_NAMES',
        given_name: 'John',
        family_name: 'Doe',
        email: 'johndoe@yahoo.com',
      };
      const newUser = createMockOAuthUser({
        displayName: 'John Doe',
      });

      vi.mocked(storage.getUserByYahooGuid).mockResolvedValue(undefined);
      vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);
      vi.mocked(storage.createOAuthUser).mockResolvedValue(newUser);

      // ACT
      await findOrCreateUserByYahooGuid(profile);

      // ASSERT
      expect(storage.createOAuthUser).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'John Doe',
        })
      );
    });
  });

  describe('completeYahooSocialLogin', () => {
    it('should extract profile from id_token and find/create user', async () => {
      // ARRANGE
      const payload = {
        sub: 'YAHOO_GUID_LOGIN',
        name: 'Login User',
        email: 'login@yahoo.com',
      };
      const idToken = createMockIdToken(payload);
      const user = createMockOAuthUser({
        yahooGuid: 'YAHOO_GUID_LOGIN',
      });

      vi.mocked(storage.getUserByYahooGuid).mockResolvedValue(undefined);
      vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);
      vi.mocked(storage.createOAuthUser).mockResolvedValue(user);

      // ACT
      const result = await completeYahooSocialLogin(idToken);

      // ASSERT
      expect(storage.getUserByYahooGuid).toHaveBeenCalledWith('YAHOO_GUID_LOGIN');
      expect(result.user).toEqual(user);
      expect(result.isNewUser).toBe(true);
    });

    it('should return existing user on login', async () => {
      // ARRANGE
      const payload = {
        sub: 'YAHOO_GUID_EXISTING_LOGIN',
        name: 'Existing Login User',
      };
      const idToken = createMockIdToken(payload);
      const existingUser = createMockOAuthUser({
        yahooGuid: 'YAHOO_GUID_EXISTING_LOGIN',
      });

      vi.mocked(storage.getUserByYahooGuid).mockResolvedValue(existingUser);

      // ACT
      const result = await completeYahooSocialLogin(idToken);

      // ASSERT
      expect(result.user).toEqual(existingUser);
      expect(result.isNewUser).toBe(false);
      expect(storage.createOAuthUser).not.toHaveBeenCalled();
    });
  });
});
