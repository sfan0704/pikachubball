import { defineConfig } from "@playwright/test";
import { workspace } from "./scripts/workspace.mts";
import { BROWSER_TEST_TIME } from "./tests/browser/fixed-time";

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
  // A test for one width only is tagged "@phone" or "@desktop"; the other project skips it.
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, hasTouch: true },
      grepInvert: /@desktop/,
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } }, grepInvert: /@phone/ },
  ],
  webServer: {
    command: "bash scripts/dev-local.sh --built",
    url: `http://localhost:${PORT}/api/health`,
    timeout: 300_000,
    // Never reuse a running server: it could be another commit's build. A busy
    // port fails the run instead of testing the wrong thing.
    reuseExistingServer: false,
    // The server's clock stays at the tests' moment; tests/browser/support.ts sets the page's.
    env: {
      PORT: String(PORT),
      STANDIN_PORT: String(STANDIN_PORT),
      LOCAL_FIXED_TIME: BROWSER_TEST_TIME,
    },
  },
});
