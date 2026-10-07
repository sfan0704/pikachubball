import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach } from 'vitest';
import { networkGuard, startNetworkGuard } from './support/network-guard';

// Start before test modules load, so a test that replaces fetch with its
// own mock still takes precedence over the guard.
startNetworkGuard();

afterEach(() => {
  cleanup();
  networkGuard.resetHandlers();
});

afterAll(() => networkGuard.close());

// Mock environment variables for tests
// Must be set BEFORE any imports that use env validation
process.env.NODE_ENV = 'test';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars
process.env.PORT = '5000';
