import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()] as any,
  test: {
    globals: true,
    // Type-aware lint tests and coverage instrumentation are slow on a loaded machine.
    testTimeout: 20_000,
    // Default to node environment for backend tests
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // Needs the local Supabase stack; run through `npm run test:db`
    exclude: ["**/node_modules/**", "tests/database/**"],
    // Use happy-dom only for frontend tests
    environmentMatchGlobs: [["tests/frontend/**", "happy-dom"]],
    // Set environment variables before any imports
    env: {
      NODE_ENV: "test",
      ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      PORT: "5000",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["client/src/**", "server/**", "shared/**"],
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*",
        // The development-only Vite middleware.
        "server/config/vite.ts",
        // The old league discovery, deleted when discovery moves behind FantasyDataSource.
        "server/fantasy/legacy/**",
      ],
      // CI fails when coverage drops below these.
      thresholds: {
        lines: 80,
        "shared/domain/**": { lines: 90 },
        "server/fantasy/**": { lines: 90 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@lib": path.resolve(__dirname, "./client/src/lib"),
      "@components": path.resolve(__dirname, "./client/src/components"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
});
