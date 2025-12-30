import type { Request, Response, NextFunction } from 'express';
import type { User } from '@shared/schema';

/**
 * Test helpers for creating mock Express objects
 */

export interface MockRequest extends Partial<Request> {
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, any>;
  user?: User;
  isAuthenticated?: () => boolean;
  login?: (user: any, callback: (err?: Error) => void) => void;
  logout?: (callback: (err?: Error) => void) => void;
  rawBody?: Buffer;
}

export interface MockResponse extends Partial<Response> {
  statusCode?: number;
  body?: any;
  headers?: Record<string, string>;
  json?: ReturnType<typeof vi.fn>;
  status?: ReturnType<typeof vi.fn>;
  send?: ReturnType<typeof vi.fn>;
  redirect?: ReturnType<typeof vi.fn>;
  cookie?: ReturnType<typeof vi.fn>;
  clearCookie?: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock Express request object
 */
export function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    isAuthenticated: () => false,
    login: (user: any, callback: (err?: Error) => void) => {
      callback();
    },
    logout: (callback: (err?: Error) => void) => {
      callback();
    },
    ...overrides,
  } as MockRequest;
}

/**
 * Create a mock Express response object
 */
export function createMockResponse(): MockResponse {
  const eventListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    headers: {},
    json: vi.fn((body: any) => {
      res.body = body;
      return res as Response;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res as Response;
    }),
    send: vi.fn((body: any) => {
      res.body = body;
      return res as Response;
    }),
    redirect: vi.fn((url: string) => {
      res.statusCode = 302;
      res.headers = { ...res.headers, Location: url };
      return res as Response;
    }),
    cookie: vi.fn(() => res as Response),
    clearCookie: vi.fn(() => res as Response),
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(callback);
      return res as any;
    }),
    emit: vi.fn((event: string, ...args: any[]) => {
      if (eventListeners[event]) {
        eventListeners[event].forEach(callback => callback(...args));
      }
      return true;
    }),
  } as any;

  return res;
}

/**
 * Create a mock NextFunction
 */
export function createMockNext(): ReturnType<typeof vi.fn<NextFunction>> {
  return vi.fn<NextFunction>();
}

/**
 * Create a mock authenticated user (local auth with password)
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    username: 'testuser',
    password: 'hashed-password',
    yahooGuid: null,
    displayName: null,
    email: null,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock OAuth user (Yahoo social login, no password)
 */
export function createMockOAuthUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-oauth-user-id',
    username: 'yahoo_user_abc123',
    password: null,
    yahooGuid: 'YAHOO_GUID_ABC123',
    displayName: 'Test Yahoo User',
    email: 'test@yahoo.com',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock authenticated request
 */
export function createAuthenticatedRequest(user?: User): MockRequest {
  const mockUser = user || createMockUser();
  return createMockRequest({
    user: mockUser,
    isAuthenticated: () => true,
  });
}

/**
 * Create a mock Yahoo authenticated request
 */
export function createYahooAuthenticatedRequest(
  user?: User,
  mcpClient?: any
): MockRequest {
  const mockUser = user || createMockUser();
  const req = createAuthenticatedRequest(mockUser);
  
  // Add Yahoo-specific properties
  (req as any).yahooToken = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: Date.now() / 1000 + 3600,
  };
  
  (req as any).mcpClient = mcpClient || {
    getUserLeagues: vi.fn(),
    getTeamRoster: vi.fn(),
    getLeagueStandings: vi.fn(),
  };
  
  return req;
}

