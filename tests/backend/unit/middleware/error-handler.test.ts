import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../../../../server/middleware/error-handler';
import { createMockRequest, createMockResponse, createMockNext } from '../../fixtures/test-helpers';
import { env } from '../../../../server/config/env';

// Mock the env module
vi.mock('../../../../server/config/env', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

describe('errorHandler middleware', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest() as Request;
    mockRes = createMockResponse() as Response;
    mockNext = createMockNext();
  });

  describe('Custom Error Classes', () => {
    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Invalid input');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should create NotFoundError with correct properties', () => {
      const error = new NotFoundError('User');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create UnauthorizedError with correct properties', () => {
      const error = new UnauthorizedError('Not logged in');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Not logged in');
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create ForbiddenError with correct properties', () => {
      const error = new ForbiddenError('No access');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('No access');
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create ConflictError with correct properties', () => {
      const error = new ConflictError('Already exists');
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Already exists');
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('errorHandler', () => {
    it('should handle ZodError and return 400 with details', () => {
      const zodError = new ZodError([
        {
          path: ['username'],
          message: 'Required',
          code: 'invalid_type',
        },
        {
          path: ['password'],
          message: 'Too short',
          code: 'too_small',
        },
      ]);

      errorHandler(zodError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: [
          { path: 'username', message: 'Required' },
          { path: 'password', message: 'Too short' },
        ],
      });
    });

    it('should handle AppError and return correct status code', () => {
      const error = new ValidationError('Invalid input');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should handle AppError with details', () => {
      const error = new ValidationError('Invalid input');
      error.details = { field: 'email', reason: 'Invalid format' };

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: { field: 'email', reason: 'Invalid format' },
      });
    });

    it('should handle unexpected errors and return 500', () => {
      const error = new Error('Unexpected error');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });

      consoleErrorSpy.mockRestore();
    });

    it('should include stack trace in development mode', () => {
      // ARRANGE
      const error = new Error('Unexpected error');
      error.stack = 'Error stack trace';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock env to return development mode
      vi.mocked(env).NODE_ENV = 'development' as any;

      // ACT
      errorHandler(error, mockReq, mockRes, mockNext);

      // ASSERT
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        stack: 'Error stack trace',
        message: 'Unexpected error',
      });

      // Restore
      vi.mocked(env).NODE_ENV = 'test' as any;
      consoleErrorSpy.mockRestore();
    });
  });

  describe('asyncHandler', () => {
    it('should call handler function with req, res, next', async () => {
      const handler = vi.fn(async (_req: Request, res: Response, _next: NextFunction) => {
        res.json({ success: true });
      });

      const wrapped = asyncHandler(handler);
      await wrapped(mockReq, mockRes, mockNext);

      expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    it('should catch errors and pass to next', async () => {
      const error = new Error('Handler error');
      const handler = vi.fn(async () => {
        throw error;
      });

      const wrapped = asyncHandler(handler);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle async errors', async () => {
      const error = new Error('Async error');
      const handler = vi.fn(async () => {
        throw error;
      });

      const wrapped = asyncHandler(handler);
      await wrapped(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext.mock.calls[0][0]).toBe(error);
    });
  });
});

