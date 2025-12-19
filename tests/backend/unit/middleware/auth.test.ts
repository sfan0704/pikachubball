import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, getAuthenticatedUserId, getAuthenticatedUser, getOptionalUserId } from '../../../../server/middleware/auth';
import { UnauthorizedError } from '../../../../server/middleware/error-handler';
import { createMockRequest, createMockResponse, createMockNext, createMockUser, createAuthenticatedRequest } from '../../fixtures/test-helpers';

describe('auth middleware', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest() as Request;
    mockRes = createMockResponse() as Response;
    mockNext = createMockNext();
  });

  describe('requireAuth', () => {
    it('should call next() if user is authenticated', () => {
      mockReq.isAuthenticated = vi.fn(() => true);

      requireAuth(mockReq, mockRes, mockNext);

      expect(mockReq.isAuthenticated).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', () => {
      mockReq.isAuthenticated = vi.fn(() => false);

      requireAuth(mockReq, mockRes, mockNext);

      expect(mockReq.isAuthenticated).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('getAuthenticatedUserId', () => {
    it('should return user ID if authenticated', () => {
      const user = createMockUser();
      mockReq = createAuthenticatedRequest(user) as Request;

      const userId = getAuthenticatedUserId(mockReq);

      expect(userId).toBe(user.id);
    });

    it('should throw UnauthorizedError if not authenticated', () => {
      mockReq.isAuthenticated = vi.fn(() => false);
      mockReq.user = undefined;

      expect(() => getAuthenticatedUserId(mockReq)).toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if user is null', () => {
      mockReq.isAuthenticated = vi.fn(() => true);
      mockReq.user = null as any;

      expect(() => getAuthenticatedUserId(mockReq)).toThrow(UnauthorizedError);
    });
  });

  describe('getAuthenticatedUser', () => {
    it('should return user object if authenticated', () => {
      const user = createMockUser();
      mockReq = createAuthenticatedRequest(user) as Request;

      const authenticatedUser = getAuthenticatedUser(mockReq);

      expect(authenticatedUser.id).toBe(user.id);
      expect(authenticatedUser.username).toBe(user.username);
      // Function returns { id, username } - the full user object is cast
      expect(typeof authenticatedUser.id).toBe('string');
      expect(typeof authenticatedUser.username).toBe('string');
    });

    it('should throw UnauthorizedError if not authenticated', () => {
      mockReq.isAuthenticated = vi.fn(() => false);
      mockReq.user = undefined;

      expect(() => getAuthenticatedUser(mockReq)).toThrow(UnauthorizedError);
    });
  });

  describe('getOptionalUserId', () => {
    it('should return user ID if authenticated', () => {
      // ARRANGE
      const user = createMockUser();
      mockReq = createAuthenticatedRequest(user) as Request;

      // ACT
      const userId = getOptionalUserId(mockReq);

      // ASSERT
      expect(userId).toBe(user.id);
    });

    it('should return null if not authenticated', () => {
      // ARRANGE
      mockReq.isAuthenticated = vi.fn(() => false);
      mockReq.user = undefined;

      // ACT
      const userId = getOptionalUserId(mockReq);

      // ASSERT
      expect(userId).toBeNull();
    });

    it('should return null if user is null', () => {
      // ARRANGE
      mockReq.isAuthenticated = vi.fn(() => true);
      mockReq.user = null as any;

      // ACT
      const userId = getOptionalUserId(mockReq);

      // ASSERT
      expect(userId).toBeNull();
    });
  });
});

