import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  requireYahooAuth,
} from '../../../../server/middleware/yahoo-auth';
import { storage } from '../../../../server/storage';
import { getAuthenticatedUserId } from '../../../../server/middleware/auth';
import { NotFoundError, UnauthorizedError } from '../../../../server/middleware/error-handler';
import { createMockResponse, createMockNext, createMockUser, createAuthenticatedRequest } from '../../fixtures/test-helpers';

// Mock dependencies
vi.mock('../../../../server/storage');
vi.mock('../../../../server/middleware/auth');

describe('yahooAuth middleware', () => {
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

  describe('requireYahooAuth', () => {
    it('should call next() if user has valid Yahoo token', async () => {
      // ARRANGE
      const token = {
        userId: mockUser.id,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };

      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.getYahooToken).mockResolvedValue(token);

      // ACT
      await requireYahooAuth(mockReq, mockRes, mockNext);

      // ASSERT
      expect(getAuthenticatedUserId).toHaveBeenCalledWith(mockReq);
      expect(storage.getYahooToken).toHaveBeenCalledWith(mockUser.id);
      expect(mockNext).toHaveBeenCalled();
      expect(mockNext.mock.calls[0][0]).toBeUndefined(); // No error passed
    });

    it('should throw UnauthorizedError if user is not authenticated', async () => {
      // ARRANGE
      vi.mocked(getAuthenticatedUserId).mockImplementation(() => {
        throw new UnauthorizedError('Authentication required');
      });

      // ACT
      await requireYahooAuth(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toBe('Authentication required');
      expect(storage.getYahooToken).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError if Yahoo token does not exist', async () => {
      // ARRANGE
      vi.mocked(getAuthenticatedUserId).mockReturnValue(mockUser.id);
      vi.mocked(storage.getYahooToken).mockResolvedValue(null);

      // ACT
      await requireYahooAuth(mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toContain('Yahoo Fantasy connection');
    });
  });
});
