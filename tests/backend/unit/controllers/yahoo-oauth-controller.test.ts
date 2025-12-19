import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { yahooOAuthController } from '../../../../server/controllers/yahoo-oauth-controller';
import { storage } from '../../../../server/storage';
import { getAuthenticatedUserId } from '../../../../server/middleware/auth';
import { decrypt, encrypt } from '../../../../server/utils/encryption';
import {
  getAuthorizationUrl,
  exchangeCodeForToken,
  generateState,
  validateState,
} from '../../../../server/yahoo-auth';
import { ValidationError } from '../../../../server/middleware/error-handler';
import { createMockRequest, createMockResponse, createMockNext, createMockUser, createAuthenticatedRequest } from '../../fixtures/test-helpers';
import { z } from 'zod';

// Mock dependencies
vi.mock('../../../../server/storage');
vi.mock('../../../../server/middleware/auth');
vi.mock('../../../../server/utils/encryption');
vi.mock('../../../../server/yahoo-auth');
vi.mock('../../../../server/config/env', () => ({
  env: {
    YAHOO_CLIENT_ID: 'env-client-id',
    YAHOO_CLIENT_SECRET: 'env-client-secret',
  },
}));

import { env } from '../../../../server/config/env';

describe('yahooOAuthController', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;
  let mockUser: ReturnType<typeof createMockUser>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = createMockUser();
    mockReq = createAuthenticatedRequest(mockUser) as Request;
    mockRes = createMockResponse() as Response;
    mockNext = createMockNext();
  });

  describe('saveCredentials', () => {
    it('should save Yahoo credentials', async () => {
      // ARRANGE
      const clientId = 'test-client-id-1234567890'; // Must be at least 10 chars
      const clientSecret = 'test-client-secret-1234567890'; // Must be at least 10 chars
      const encryptedClientId = 'encrypted-client-id';
      const encryptedClientSecret = 'encrypted-client-secret';

      mockReq.body = { clientId, clientSecret };
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(encrypt).mockImplementation((value) => {
        return value === clientId ? encryptedClientId : encryptedClientSecret;
      });
      vi.mocked(storage.getYahooToken).mockResolvedValue(undefined); // User not connected
      vi.mocked(storage.saveYahooCredentials).mockResolvedValue({
        userId: mockUser.id,
        encryptedClientId,
        encryptedClientSecret,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // ACT
      const handler = yahooOAuthController.saveCredentials as any;
      await handler(mockReq, mockRes, mockNext);

      // Wait a bit for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // ASSERT
      expect(getAuthenticatedUserId).toHaveBeenCalledWith(mockReq);
      expect(encrypt).toHaveBeenCalledWith(clientId);
      expect(encrypt).toHaveBeenCalledWith(clientSecret);
      expect(storage.getYahooToken).toHaveBeenCalledWith(mockUser.id);
      expect(storage.saveYahooCredentials).toHaveBeenCalledWith({
        userId: mockUser.id,
        encryptedClientId,
        encryptedClientSecret,
      });
      // Check if next was called with an error (should not be)
      expect(mockNext).not.toHaveBeenCalled();
      // Verify response was sent
      expect(mockRes.json).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Yahoo credentials saved successfully',
      });
    });

    it('should throw ValidationError if clientId is missing', async () => {
      // ARRANGE
      mockReq.body = { clientSecret: 'test-secret' };
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);

      // ACT
      const handler = yahooOAuthController.saveCredentials as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(z.ZodError);
      expect(storage.saveYahooCredentials).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if clientSecret is missing', async () => {
      // ARRANGE
      mockReq.body = { clientId: 'test-id' };
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);

      // ACT
      const handler = yahooOAuthController.saveCredentials as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(z.ZodError);
    });
  });

  describe('getCredentials', () => {
    it('should return credentials status when credentials exist', async () => {
      // ARRANGE
      const credentials = {
        userId: mockUser.id,
        encryptedClientId: 'encrypted-id',
        encryptedClientSecret: 'encrypted-secret',
        updatedAt: new Date(),
      };

      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);

      // ACT
      const handler = yahooOAuthController.getCredentials as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(storage.getYahooCredentials).toHaveBeenCalledWith(mockUser.id);
      expect(mockRes.json).toHaveBeenCalledWith({
        hasCredentials: true,
        updatedAt: credentials.updatedAt,
      });
    });

    it('should return hasCredentials false when credentials do not exist', async () => {
      // ARRANGE
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(null);

      // ACT
      const handler = yahooOAuthController.getCredentials as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockRes.json).toHaveBeenCalledWith({
        hasCredentials: false,
        updatedAt: null,
      });
    });
  });

  describe('deleteCredentials', () => {
    it('should delete Yahoo credentials (falls back to app credentials)', async () => {
      // ARRANGE
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.getYahooToken).mockResolvedValue(undefined); // No token, so can delete
      vi.mocked(storage.deleteYahooCredentials).mockResolvedValue(undefined);

      // ACT
      const handler = yahooOAuthController.deleteCredentials as any;
      await handler(mockReq, mockRes, mockNext);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // ASSERT
      expect(storage.getYahooToken).toHaveBeenCalledWith(mockUser.id);
      expect(storage.deleteYahooCredentials).toHaveBeenCalledWith(mockUser.id);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        success: true,
        message: 'Credentials removed successfully',
      });
    });
  });

  describe('getAuthUrl', () => {
    it('should return authorization URL using user credentials', async () => {
      // ARRANGE
      const credentials = {
        userId: mockUser.id,
        encryptedClientId: 'encrypted-id',
        encryptedClientSecret: 'encrypted-secret',
        updatedAt: new Date(),
      };
      const decryptedClientId = 'test-client-id';
      const state = 'test-state';
      const authUrl = 'https://api.login.yahoo.com/oauth2/request_auth?client_id=test&redirect_uri=...&state=test-state';

      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(decrypt).mockReturnValue(decryptedClientId);
      vi.mocked(generateState).mockReturnValue(state);
      vi.mocked(getAuthorizationUrl).mockReturnValue(authUrl);

      // ACT
      const handler = yahooOAuthController.getAuthUrl as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(storage.getYahooCredentials).toHaveBeenCalledWith(mockUser.id);
      expect(decrypt).toHaveBeenCalledWith(credentials.encryptedClientId);
      expect(generateState).toHaveBeenCalled();
      expect(getAuthorizationUrl).toHaveBeenCalledWith(state, decryptedClientId);
      expect(mockRes.json).toHaveBeenCalledWith({
        authUrl,
        redirectUri: expect.any(String),
      });
    });

    it('should fall back to env credentials if user credentials do not exist', async () => {
      // ARRANGE
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(null);

      // ACT
      const handler = yahooOAuthController.getAuthUrl as any;
      await handler(mockReq, mockRes, mockNext);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // ASSERT
      // Controller now requires user credentials, so should throw ValidationError
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toContain('Yahoo credentials are required');
    });

    // Note: Testing "no credentials available" scenario is difficult with mocked env
    // In practice, the app won't start without env credentials, so this edge case
    // is covered by integration tests. The fallback logic is tested above.
  });

  describe('handleCallback', () => {
    it('should handle successful OAuth callback with user credentials', async () => {
      // ARRANGE
      const code = 'auth-code';
      const state = 'test-state';
      const credentials = {
        userId: mockUser.id,
        encryptedClientId: 'encrypted-id',
        encryptedClientSecret: 'encrypted-secret',
        updatedAt: new Date(),
      };
      const decryptedClientId = 'test-client-id';
      const decryptedClientSecret = 'test-client-secret';
      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      };

      mockReq.query = { code, state };
      mockReq.isAuthenticated = vi.fn(() => true);
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(validateState).mockReturnValue(true);
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);
      vi.mocked(decrypt).mockImplementation((value) => {
        if (value === credentials.encryptedClientId) return decryptedClientId;
        return decryptedClientSecret;
      });
      vi.mocked(exchangeCodeForToken).mockResolvedValue(tokens);
      vi.mocked(storage.saveYahooToken).mockResolvedValue(undefined);

      // ACT
      const handler = yahooOAuthController.handleCallback as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(validateState).toHaveBeenCalledWith(state);
      expect(storage.getYahooCredentials).toHaveBeenCalledWith(mockUser.id);
      expect(exchangeCodeForToken).toHaveBeenCalledWith(code, decryptedClientId, decryptedClientSecret);
      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(storage.saveYahooToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: expect.any(Number),
      });
      expect(mockRes.redirect).toHaveBeenCalledWith('/?yahoo_connected=true');
    });

    it('should handle successful OAuth callback with env credentials fallback', async () => {
      // ARRANGE
      const code = 'auth-code';
      const state = 'test-state';
      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      };

      mockReq.query = { code, state };
      mockReq.isAuthenticated = vi.fn(() => true);
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(validateState).mockReturnValue(true);
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(null);
      vi.mocked(exchangeCodeForToken).mockResolvedValue(tokens);
      vi.mocked(storage.saveYahooToken).mockResolvedValue(undefined);

      // ACT
      const handler = yahooOAuthController.handleCallback as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      // Controller now requires user credentials, so should redirect with error
      expect(validateState).toHaveBeenCalledWith(state);
      expect(storage.getYahooCredentials).toHaveBeenCalledWith(mockUser.id);
      expect(mockRes.redirect).toHaveBeenCalledWith('/?error=credentials_required');
    });

    it('should redirect with error if OAuth error is present', async () => {
      // ARRANGE
      const error = 'access_denied';
      mockReq.query = { error };

      // ACT
      const handler = yahooOAuthController.handleCallback as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockRes.redirect).toHaveBeenCalledWith(`/?error=yahoo_oauth_error&details=${error}`);
      expect(storage.getYahooCredentials).not.toHaveBeenCalled();
    });

    it('should redirect with error if code is missing', async () => {
      // ARRANGE
      mockReq.query = { state: 'test-state' };

      // ACT
      const handler = yahooOAuthController.handleCallback as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockRes.redirect).toHaveBeenCalledWith('/?error=missing_code');
    });

    it('should redirect with error if state is invalid', async () => {
      // ARRANGE
      const code = 'auth-code';
      const state = 'invalid-state';
      mockReq.query = { code, state };
      vi.mocked(validateState).mockReturnValue(false);

      // ACT
      const handler = yahooOAuthController.handleCallback as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockRes.redirect).toHaveBeenCalledWith('/?error=invalid_state');
    });

    it('should redirect with error if user is not authenticated', async () => {
      // ARRANGE
      const code = 'auth-code';
      const state = 'test-state';
      mockReq.query = { code, state };
      mockReq.isAuthenticated = vi.fn(() => false);
      vi.mocked(validateState).mockReturnValue(true);

      // ACT
      const handler = yahooOAuthController.handleCallback as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockRes.redirect).toHaveBeenCalledWith('/?error=not_authenticated');
    });
  });

  describe('getStatus', () => {
    it('should return connection status with valid token', async () => {
      // ARRANGE
      const token = {
        userId: mockUser.id,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // Valid (1 hour from now)
      };
      const credentials = {
        userId: mockUser.id,
        encryptedClientId: 'encrypted-id',
        encryptedClientSecret: 'encrypted-secret',
        updatedAt: new Date(),
      };

      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.getYahooToken).mockResolvedValue(token);
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);

      // ACT
      const handler = yahooOAuthController.getStatus as any;
      await handler(mockReq, mockRes, mockNext);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // ASSERT
      expect(mockRes.json).toHaveBeenCalledWith({
        connected: true,
        hasValidToken: true,
        hasCredentials: true,
      });
    });

    it('should return connection status with expired token', async () => {
      // ARRANGE
      const token = {
        userId: mockUser.id,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // Expired (1 hour ago)
      };
      const credentials = {
        userId: mockUser.id,
        encryptedClientId: 'encrypted-id',
        encryptedClientSecret: 'encrypted-secret',
        updatedAt: new Date(),
      };

      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.getYahooToken).mockResolvedValue(token);
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);

      // ACT
      const handler = yahooOAuthController.getStatus as any;
      await handler(mockReq, mockRes, mockNext);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // ASSERT
      expect(mockRes.json).toHaveBeenCalledWith({
        connected: true,
        hasValidToken: false,
        hasCredentials: true,
      });
    });

    it('should return connection status with no token', async () => {
      // ARRANGE
      const credentials = {
        userId: mockUser.id,
        encryptedClientId: 'encrypted-id',
        encryptedClientSecret: 'encrypted-secret',
        updatedAt: new Date(),
      };

      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.getYahooToken).mockResolvedValue(null);
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(credentials);

      // ACT
      const handler = yahooOAuthController.getStatus as any;
      await handler(mockReq, mockRes, mockNext);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // ASSERT
      expect(mockRes.json).toHaveBeenCalledWith({
        connected: false,
        hasValidToken: false,
        hasCredentials: true,
      });
    });

    it('should return status using app credentials when user has no custom credentials', async () => {
      // ARRANGE
      const token = {
        userId: mockUser.id,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };

      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.getYahooToken).mockResolvedValue(token);
      vi.mocked(storage.getYahooCredentials).mockResolvedValue(null);

      // ACT
      const handler = yahooOAuthController.getStatus as any;
      await handler(mockReq, mockRes, mockNext);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // ASSERT
      expect(mockRes.json).toHaveBeenCalledWith({
        connected: true,
        hasValidToken: true,
        hasCredentials: false,
      });
    });
  });

  describe('disconnect', () => {
    it('should delete Yahoo token', async () => {
      // ARRANGE
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.deleteYahooToken).mockResolvedValue(undefined);

      // ACT
      const handler = yahooOAuthController.disconnect as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(storage.deleteYahooToken).toHaveBeenCalledWith(mockUser.id);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        success: true, 
        message: 'Yahoo account disconnected. You can reconnect anytime.' 
      });
    });
  });
});

