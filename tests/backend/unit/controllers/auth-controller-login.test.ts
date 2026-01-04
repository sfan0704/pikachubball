import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authController } from '../../../../server/controllers/auth-controller';
import { passport } from '../../../../server/config/auth';
import { createMockRequest, createMockResponse, createMockNext, createMockUser } from '../../fixtures/test-helpers';

// Mock dependencies
vi.mock('../../../../server/config/auth', () => ({
  passport: {
    authenticate: vi.fn(),
  },
  hashPassword: vi.fn(),
}));

describe('authController.login', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest() as Request;
    mockRes = createMockResponse() as Response;
    mockNext = createMockNext();
  });

  it('should authenticate user and return user without password', async () => {
    // ARRANGE
    const user = createMockUser();
    let authCallback: (err: Error | null, user: any, info?: { message: string }) => void;

    vi.mocked(passport.authenticate).mockImplementation((strategy: string, callback: (err: Error | null, user: any, info?: { message: string }) => void) => {
      authCallback = callback;
      return (_req: Request, _res: Response, _next: NextFunction) => {
        // Call the callback with success
        authCallback(null, user, undefined);
      };
    });

    mockReq.login = vi.fn((user: any, callback: (err?: Error) => void) => {
      callback();
    }) as any;

    // ACT
    authController.login(mockReq, mockRes, mockNext);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // ASSERT
    expect(passport.authenticate).toHaveBeenCalledWith('local', expect.any(Function));
    expect(mockReq.login).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith({
      user: {
        id: user.id,
        username: user.username,
        yahooGuid: user.yahooGuid,
        displayName: user.displayName,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  });

  it('should return 401 if authentication fails (no user)', async () => {
    // ARRANGE
    let authCallback: (err: Error | null, user: any, info?: { message: string }) => void;

    vi.mocked(passport.authenticate).mockImplementation((strategy: string, callback: (err: Error | null, user: any, info?: { message: string }) => void) => {
      authCallback = callback;
      return (_req: Request, _res: Response, _next: NextFunction) => {
        authCallback(null, null, { message: 'Invalid credentials' });
      };
    });

    // ACT
    authController.login(mockReq, mockRes, mockNext);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // ASSERT
    expect(passport.authenticate).toHaveBeenCalledWith('local', expect.any(Function));
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Invalid credentials',
      code: 'UNAUTHORIZED',
    });
    // login should not be called when authentication fails
    if (typeof mockReq.login === 'function' && 'mock' in mockReq.login) {
      expect(mockReq.login).not.toHaveBeenCalled();
    }
  });

  it('should return 401 with default message if info is missing', async () => {
    // ARRANGE
    let authCallback: (err: Error | null, user: any, info?: { message: string }) => void;

    vi.mocked(passport.authenticate).mockImplementation((strategy: string, callback: (err: Error | null, user: any, info?: { message: string }) => void) => {
      authCallback = callback;
      return (_req: Request, _res: Response, _next: NextFunction) => {
        authCallback(null, null, undefined);
      };
    });

    // ACT
    authController.login(mockReq, mockRes, mockNext);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // ASSERT
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Authentication failed',
      code: 'UNAUTHORIZED',
    });
  });

  it('should pass error to next if passport authentication fails', async () => {
    // ARRANGE
    const authError = new Error('Passport error');
    let authCallback: (err: Error | null, user: any, info?: { message: string }) => void;

    vi.mocked(passport.authenticate).mockImplementation((strategy: string, callback: (err: Error | null, user: any, info?: { message: string }) => void) => {
      authCallback = callback;
      return (_req: Request, _res: Response, _next: NextFunction) => {
        authCallback(authError, null, undefined);
      };
    });

    // ACT
    authController.login(mockReq, mockRes, mockNext);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // ASSERT
    expect(mockNext).toHaveBeenCalledWith(authError);
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should pass error to next if login callback fails', async () => {
    // ARRANGE
    const user = createMockUser();
    const loginError = new Error('Login failed');
    let authCallback: (err: Error | null, user: any, info?: { message: string }) => void;
    
    vi.mocked(passport.authenticate).mockImplementation((strategy: string, callback: (err: Error | null, user: any, info?: { message: string }) => void) => {
      authCallback = callback;
      return (_req: Request, _res: Response, _next: NextFunction) => {
        authCallback(null, user, undefined);
      };
    });

    mockReq.login = vi.fn((user: any, callback: (err?: Error) => void) => {
      callback(loginError);
    }) as any;

    // ACT
    authController.login(mockReq, mockRes, mockNext);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // ASSERT
    expect(mockNext).toHaveBeenCalledWith(loginError);
    expect(mockRes.json).not.toHaveBeenCalled();
  });
});

