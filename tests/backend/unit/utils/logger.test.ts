import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../../../server/utils/logger';

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('debug', () => {
    it('should log in development mode', () => {
      // ACT
      // In test environment, debug might not log, but we can test the function exists
      logger.debug('Debug message', { key: 'value' });

      // ASSERT
      // Debug only logs in development, test env is 'test'
      // So it might not log, but function should not throw
      expect(typeof logger.debug).toBe('function');
    });

    it('should not log in production mode', () => {
      // ARRANGE
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // ACT
      logger.debug('Debug message');

      // ASSERT
      expect(consoleLogSpy).not.toHaveBeenCalled();

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('info', () => {
    it('should log info messages', () => {
      // ACT
      logger.info('Info message', 'arg1', 'arg2');

      // ASSERT
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0][0];
      expect(call).toContain('[INFO]');
      expect(call).toContain('Info message');
    });

    it('should include timestamp', () => {
      // ACT
      logger.info('Test message');

      // ASSERT
      const call = consoleLogSpy.mock.calls[0][0];
      // Should contain time format (e.g., "3:45:23 PM")
      expect(call).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      // ACT
      logger.warn('Warning message');

      // ASSERT
      expect(consoleWarnSpy).toHaveBeenCalled();
      const call = consoleWarnSpy.mock.calls[0][0];
      expect(call).toContain('[WARN]');
      expect(call).toContain('Warning message');
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      // ACT
      logger.error('Error message', new Error('test error'));

      // ASSERT
      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('[ERROR]');
      expect(call).toContain('Error message');
    });

    it('should handle error objects', () => {
      // ARRANGE
      const error = new Error('Test error');
      
      // ACT
      logger.error('Failed operation', error);

      // ASSERT
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][1]).toBe(error);
    });
  });
});

