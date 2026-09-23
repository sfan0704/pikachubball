import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { yahooOAuthController } from '../../../../server/controllers/yahoo-oauth-controller';
import { getAuthenticatedUserId } from '../../../../server/middleware/auth';
import { revokeYahooToken } from '../../../../server/yahoo-auth';
import { createMockResponse, createMockNext, createMockUser, createAuthenticatedRequest } from '../../fixtures/test-helpers';

// Mock dependencies
vi.mock('../../../../server/middleware/auth');
vi.mock('../../../../server/yahoo-auth', () => ({
  exchangeAuthorizationCode: vi.fn(),
  revokeYahooToken: vi.fn(),
}));

describe('yahooOAuthController', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;
  let mockUser: ReturnType<typeof createMockUser>;
  const getYahooToken = vi.fn();
  const deleteYahooToken = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = createMockUser();
    mockReq = createAuthenticatedRequest(mockUser) as Request;
    mockReq.ownerStorage = {
      getYahooToken,
      deleteYahooToken,
    } as Request["ownerStorage"];
    mockRes = createMockResponse() as Response;
    mockNext = createMockNext();
  });

  describe('getStatus', () => {
    it('should return connection status with valid token', async () => {
      // ARRANGE
      const token = {
        id: 'token-1',
        userId: mockUser.id,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // Valid (1 hour from now)
      };

      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      getYahooToken.mockResolvedValue(token);

      // ACT
      const handler = yahooOAuthController.getStatus as any;
      await handler(mockReq, mockRes, mockNext);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // ASSERT
      expect(mockRes.json).toHaveBeenCalledWith({
        connected: true,
        hasValidToken: true,
      });
    });

    it('should return connection status with expired token', async () => {
      // ARRANGE
      const token = {
        id: 'token-1',
        userId: mockUser.id,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // Expired (1 hour ago)
      };

      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      getYahooToken.mockResolvedValue(token);

      // ACT
      const handler = yahooOAuthController.getStatus as any;
      await handler(mockReq, mockRes, mockNext);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // ASSERT
      expect(mockRes.json).toHaveBeenCalledWith({
        connected: true,
        hasValidToken: false,
      });
    });

    it('should return connection status with no token', async () => {
      // ARRANGE
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      getYahooToken.mockResolvedValue(undefined);

      // ACT
      const handler = yahooOAuthController.getStatus as any;
      await handler(mockReq, mockRes, mockNext);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // ASSERT
      expect(mockRes.json).toHaveBeenCalledWith({
        connected: false,
        hasValidToken: false,
      });
    });

    it('should throw ValidationError if user is not authenticated', async () => {
      // ARRANGE
      vi.mocked(getAuthenticatedUserId).mockReturnValue(null);

      // ACT
      const handler = yahooOAuthController.getStatus as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Authentication required');
    });
  });

  describe('disconnect', () => {
    const storedToken = {
      userId: 'placeholder',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    beforeEach(() => {
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      getYahooToken.mockReset().mockResolvedValue({ ...storedToken, userId: mockUser.id });
      deleteYahooToken.mockReset().mockResolvedValue(undefined);
    });

    it('revokes the refresh token at Yahoo, then deletes it locally', async () => {
      vi.mocked(revokeYahooToken).mockResolvedValue(true);

      (yahooOAuthController.disconnect as any)(mockReq, mockRes, mockNext);
      await vi.waitFor(() => expect(mockRes.json).toHaveBeenCalled());

      expect(revokeYahooToken).toHaveBeenCalledWith(
        'refresh-token',
        expect.any(String),
        expect.any(String),
      );
      expect(deleteYahooToken).toHaveBeenCalledWith(mockUser.id);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        revokedAtYahoo: true,
        message: 'Yahoo account disconnected and access revoked at Yahoo.',
      });
    });

    it('still deletes local tokens and says so when Yahoo does not confirm revocation', async () => {
      vi.mocked(revokeYahooToken).mockResolvedValue(false);

      (yahooOAuthController.disconnect as any)(mockReq, mockRes, mockNext);
      await vi.waitFor(() => expect(mockRes.json).toHaveBeenCalled());

      expect(deleteYahooToken).toHaveBeenCalledWith(mockUser.id);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        revokedAtYahoo: false,
        message: expect.stringContaining('Yahoo did not confirm revocation'),
      });
    });

    it('still deletes local tokens when the stored token cannot be read', async () => {
      getYahooToken.mockRejectedValue(new Error('Stored Yahoo credential could not be authenticated'));

      (yahooOAuthController.disconnect as any)(mockReq, mockRes, mockNext);
      await vi.waitFor(() => expect(mockRes.json).toHaveBeenCalled());

      expect(revokeYahooToken).not.toHaveBeenCalled();
      expect(deleteYahooToken).toHaveBeenCalledWith(mockUser.id);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, revokedAtYahoo: false }),
      );
    });

    it('should throw ValidationError if user is not authenticated', async () => {
      // ARRANGE
      vi.mocked(getAuthenticatedUserId).mockReturnValue(null);

      // ACT
      const handler = yahooOAuthController.disconnect as any;
      await handler(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Authentication required');
    });
  });
});
