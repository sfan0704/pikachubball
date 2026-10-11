import { defineConfig } from "@playwright/test";
import { workspace } from "./scripts/workspace.mts";

// This checkout's own ports (scripts/workspace.mts), so two workspaces can run
// browser tests at once. Set here so the test workers inherit them.
const { ports } = workspace();
const PORT = ports.browser;
const STANDIN_PORT = ports.browserStandIn;
process.env.E2E_STANDIN_PORT = String(STANDIN_PORT);

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
    // Never reuse a running server: it could be another commit's build. A busy
    // port fails the run instead of testing the wrong thing.
    reuseExistingServer: false,
    env: { PORT: String(PORT), STANDIN_PORT: String(STANDIN_PORT) },
  },
});
