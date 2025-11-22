import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()] as any,
  test: {
    globals: true,
    // Default to node environment for backend tests
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Use happy-dom only for frontend tests
    environmentMatchGlobs: [
      ['tests/frontend/**', 'happy-dom'],
      ['tests/e2e/**', 'happy-dom'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'server/vite.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@lib': path.resolve(__dirname, './client/src/lib'),
      '@components': path.resolve(__dirname, './client/src/components'),
      '@assets': path.resolve(__dirname, './attached_assets'),
    },
  },
});
