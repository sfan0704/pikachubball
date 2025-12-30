import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { yahooOAuthController } from '../../../../server/controllers/yahoo-oauth-controller';
import { storage } from '../../../../server/storage';
import { getAuthenticatedUserId } from '../../../../server/middleware/auth';
import { createMockRequest, createMockResponse, createMockNext, createMockUser, createAuthenticatedRequest } from '../../fixtures/test-helpers';

// Mock dependencies
vi.mock('../../../../server/storage');
vi.mock('../../../../server/middleware/auth');

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
      vi.mocked(storage.getYahooToken).mockResolvedValue(token);

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
      vi.mocked(storage.getYahooToken).mockResolvedValue(token);

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
      vi.mocked(storage.getYahooToken).mockResolvedValue(undefined);

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
        message: 'Yahoo account disconnected.' 
      });
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
