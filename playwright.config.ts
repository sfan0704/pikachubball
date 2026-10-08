import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 5070);
const STANDIN_PORT = Number(process.env.E2E_STANDIN_PORT ?? 5096);

/**
 * Browser tests of the main flows against the production build, the throwaway
 * local Supabase stack and the Yahoo stand-in. Run through `npm run test:browser`
 * after `npm run build`; it needs Docker.
 */
export default defineConfig({
  testDir: "tests/browser",
  // The stand-in's scenario is shared state, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Locally the installed Chrome is enough; CI installs Playwright's Chromium.
    channel: process.env.PW_CHANNEL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "bash scripts/dev-local.sh --built",
    url: `http://localhost:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT), STANDIN_PORT: String(STANDIN_PORT) },
  },
});
