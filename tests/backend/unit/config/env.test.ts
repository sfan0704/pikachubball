import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('config/env', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalExit: typeof process.exit;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Save original values
    originalEnv = { ...process.env };
    originalExit = process.exit;
    originalConsoleError = console.error;

    // Mock process.exit to prevent actual exit
    process.exit = vi.fn() as any;
    console.error = vi.fn();
  });

  afterEach(() => {
    // Restore original values
    process.env = originalEnv;
    process.exit = originalExit;
    console.error = originalConsoleError;
    
    // Clear module cache to force re-import
    vi.resetModules();
  });

  it('should validate required environment variables', async () => {
    // ARRANGE
    process.env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      PORT: '5000',
    };

    // ACT
    const { env } = await import('../../../../server/config/env');

    // ASSERT
    expect(env.DATABASE_URL).toBe('postgresql://test:test@localhost:5432/test');
    expect(env.SESSION_SECRET).toBe('test-secret-that-is-at-least-32-characters-long');
    expect(env.ENCRYPTION_KEY).toBe('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    expect(env.PORT).toBe(5000);
  });

  it('should use default values for NODE_ENV and PORT', async () => {
    // ARRANGE
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-characters-long';
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    // ACT
    const { env } = await import('../../../../server/config/env');

    // ASSERT
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(5000);
  });

  it('should parse PORT as number', async () => {
    // ARRANGE
    process.env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      PORT: '8080',
    };

    // ACT
    const { env } = await import('../../../../server/config/env');

    // ASSERT
    expect(env.PORT).toBe(8080);
    expect(typeof env.PORT).toBe('number');
  });

  it('should handle optional Yahoo OAuth credentials', async () => {
    // ARRANGE
    process.env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      PORT: '5000',
      YAHOO_CLIENT_ID: 'test-client-id',
      YAHOO_CLIENT_SECRET: 'test-client-secret',
    };

    // ACT
    const { env } = await import('../../../../server/config/env');

    // ASSERT
    expect(env.YAHOO_CLIENT_ID).toBe('test-client-id');
    expect(env.YAHOO_CLIENT_SECRET).toBe('test-client-secret');
  });

  it('should handle optional YAHOO_REDIRECT_URI', async () => {
    // ARRANGE
    process.env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      PORT: '5000',
      YAHOO_REDIRECT_URI: 'https://example.com/callback',
    };

    // ACT
    const { env } = await import('../../../../server/config/env');

    // ASSERT
    expect(env.YAHOO_REDIRECT_URI).toBe('https://example.com/callback');
  });

  it('should handle optional REPLIT_DEV_DOMAIN', async () => {
    // ARRANGE
    process.env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      PORT: '5000',
      REPLIT_DEV_DOMAIN: 'example.replit.dev',
    };

    // ACT
    const { env } = await import('../../../../server/config/env');

    // ASSERT
    expect(env.REPLIT_DEV_DOMAIN).toBe('example.replit.dev');
  });

  it('should parse TRUST_PROXY as boolean', async () => {
    // ARRANGE
    process.env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      PORT: '5000',
      TRUST_PROXY: 'true',
    };

    // ACT
    const { env } = await import('../../../../server/config/env');

    // ASSERT
    expect(env.TRUST_PROXY).toBe(true);
  });

  it('should parse TRUST_PROXY as false when not "true"', async () => {
    // ARRANGE
    process.env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      PORT: '5000',
      TRUST_PROXY: 'false',
    };

    // ACT
    const { env } = await import('../../../../server/config/env');

    // ASSERT
    expect(env.TRUST_PROXY).toBe(false);
  });

  describe('validation errors', () => {
    it('should throw error in test environment when DATABASE_URL is invalid', async () => {
      // ARRANGE
      process.env = {
        NODE_ENV: 'test',
        DATABASE_URL: 'not-a-url',
        SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
        ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        PORT: '5000',
      };

      // ACT & ASSERT
      await expect(async () => {
        await import('../../../../server/config/env');
      }).rejects.toThrow('Environment variable validation failed');
    });

    it('should throw error in test environment when SESSION_SECRET is too short', async () => {
      // ARRANGE
      process.env = {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        SESSION_SECRET: 'short',
        ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        PORT: '5000',
      };

      // ACT & ASSERT
      await expect(async () => {
        await import('../../../../server/config/env');
      }).rejects.toThrow('Environment variable validation failed');
    });

    it('should throw error in test environment when ENCRYPTION_KEY is wrong length', async () => {
      // ARRANGE
      process.env = {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
        ENCRYPTION_KEY: 'too-short',
        PORT: '5000',
      };

      // ACT & ASSERT
      await expect(async () => {
        await import('../../../../server/config/env');
      }).rejects.toThrow('Environment variable validation failed');
    });

    it('should throw error in test environment when NODE_ENV is invalid', async () => {
      // ARRANGE
      process.env = {
        NODE_ENV: 'invalid',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
        ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        PORT: '5000',
      };

      // ACT & ASSERT
      await expect(async () => {
        await import('../../../../server/config/env');
      }).rejects.toThrow();
    });

    it('should exit process in production when validation fails', async () => {
      // ARRANGE
      process.env = {
        NODE_ENV: 'production',
        DATABASE_URL: 'not-a-url',
        SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
        ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        PORT: '5000',
      };

      // ACT
      try {
        await import('../../../../server/config/env');
      } catch {
        // Expected to fail
      }

      // ASSERT
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit process in development when validation fails', async () => {
      // ARRANGE
      process.env = {
        NODE_ENV: 'development',
        DATABASE_URL: 'not-a-url',
        SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
        ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        PORT: '5000',
      };

      // ACT
      try {
        await import('../../../../server/config/env');
      } catch {
        // Expected to fail
      }

      // ASSERT
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should validate YAHOO_REDIRECT_URI as URL when provided', async () => {
      // ARRANGE
      process.env = {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
        ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        PORT: '5000',
        YAHOO_REDIRECT_URI: 'not-a-url',
      };

      // ACT & ASSERT
      await expect(async () => {
        await import('../../../../server/config/env');
      }).rejects.toThrow('Environment variable validation failed');
    });
  });
});
