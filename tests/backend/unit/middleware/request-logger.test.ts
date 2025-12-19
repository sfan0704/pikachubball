import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requestLogger } from '../../../../server/middleware/request-logger';
import { logger } from '../../../../server/utils/logger';
import { createMockRequest, createMockResponse, createMockNext } from '../../fixtures/test-helpers';

// Mock logger
vi.mock('../../../../server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('requestLogger', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest() as Request;
    mockRes = createMockResponse() as Response;
    mockNext = createMockNext();
  });

  it('should call next() immediately', () => {
    // ARRANGE
    mockReq.path = '/api/test';
    mockReq.method = 'GET';

    // ACT
    requestLogger(mockReq, mockRes, mockNext);

    // ASSERT
    expect(mockNext).toHaveBeenCalled();
  });

  it('should log API requests with method, path, and status', async () => {
    // ARRANGE
    mockReq.path = '/api/test';
    mockReq.method = 'GET';
    mockRes.statusCode = 200;

    // ACT
    requestLogger(mockReq, mockRes, mockNext);

    // Simulate response finish
    mockRes.emit('finish');

    // ASSERT
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(logger.info).toHaveBeenCalled();
    const logCall = vi.mocked(logger.info).mock.calls[0][0];
    expect(logCall).toContain('GET');
    expect(logCall).toContain('/api/test');
    expect(logCall).toContain('200');
  });

  it('should log API requests with response body', async () => {
    // ARRANGE
    mockReq.path = '/api/test';
    mockReq.method = 'POST';
    mockRes.statusCode = 201;
    const responseBody = { success: true, id: '123' };

    // ACT
    requestLogger(mockReq, mockRes, mockNext);
    mockRes.json(responseBody);
    mockRes.emit('finish');

    // ASSERT
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(logger.info).toHaveBeenCalled();
    const logCall = vi.mocked(logger.info).mock.calls[0][0];
    expect(logCall).toContain('POST');
    expect(logCall).toContain('/api/test');
    expect(logCall).toContain('201');
  });

  it('should not log non-API requests', async () => {
    // ARRANGE
    mockReq.path = '/static/style.css';
    mockReq.method = 'GET';
    mockRes.statusCode = 200;

    // ACT
    requestLogger(mockReq, mockRes, mockNext);
    mockRes.emit('finish');

    // ASSERT
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should truncate long log messages', async () => {
    // ARRANGE
    mockReq.path = '/api/test';
    mockReq.method = 'GET';
    mockRes.statusCode = 200;
    const longResponseBody = { data: 'x'.repeat(100) };

    // ACT
    requestLogger(mockReq, mockRes, mockNext);
    mockRes.json(longResponseBody);
    mockRes.emit('finish');

    // ASSERT
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(logger.info).toHaveBeenCalled();
    const logCall = vi.mocked(logger.info).mock.calls[0][0];
    expect(logCall.length).toBeLessThanOrEqual(80);
    expect(logCall).toContain('…');
  });

  it('should log request duration', async () => {
    // ARRANGE
    mockReq.path = '/api/test';
    mockReq.method = 'GET';
    mockRes.statusCode = 200;

    // ACT
    requestLogger(mockReq, mockRes, mockNext);
    
    // Simulate response finish after a delay
    await new Promise(resolve => setTimeout(resolve, 5));
    mockRes.emit('finish');

    // ASSERT
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(logger.info).toHaveBeenCalled();
    const logCall = vi.mocked(logger.info).mock.calls[0][0];
    expect(logCall).toMatch(/\d+ms/);
  });
});

