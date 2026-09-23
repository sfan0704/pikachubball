import { defineConfig } from 'vitest/config';

// Data API isolation tests against the disposable local Supabase stack.
// Run through `npm run test:db`, which starts the stack and exports its URL/key.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/database/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
