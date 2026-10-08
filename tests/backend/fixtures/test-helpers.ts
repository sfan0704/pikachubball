import type { Request, Response, NextFunction } from "express";
import { vi } from "vitest";
import { buildRequestContext } from "../../support/context";

/** A request with only what the middleware tests read; cast to Request where Express wants one. */
export interface MockRequest extends Partial<Request> {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
}

/** A response that records what was sent; its handlers are spies. */
export interface MockResponse extends Partial<Response> {
  statusCode?: number;
  body?: unknown;
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
    ...overrides,
  };
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
  };
  const asResponse = () => res as Response;
  Object.assign(res, {
    json: vi.fn((body: unknown) => {
      res.body = body;
      return asResponse();
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return asResponse();
    }),
    send: vi.fn((body: unknown) => {
      res.body = body;
      return asResponse();
    }),
    redirect: vi.fn((url: string) => {
      res.statusCode = 302;
      res.headers = { ...res.headers, Location: url };
      return asResponse();
    }),
    setHeader: vi.fn((name: string, value: string) => {
      res.headers = { ...res.headers, [name]: value };
      return asResponse();
    }),
    cookie: vi.fn(() => asResponse()),
    clearCookie: vi.fn(() => asResponse()),
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      (eventListeners[event] ??= []).push(callback);
      return asResponse();
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      eventListeners[event]?.forEach((callback) => callback(...args));
      return true;
    }),
  });

  return res;
}

/**
 * Create a mock NextFunction
 */
export function createMockNext(): ReturnType<typeof vi.fn<NextFunction>> {
  return vi.fn<NextFunction>();
}

/**
 * Create a mock request from a signed-in user
 */
export function createAuthenticatedRequest(): MockRequest {
  const request = createMockRequest();
  request.context = buildRequestContext({
    user: {
      userId: "test-user-id",
      yahooGuid: "testuser",
      displayName: null,
      email: null,
    },
  });
  return request;
}
