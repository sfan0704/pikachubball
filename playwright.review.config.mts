import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mts";
import { workspace } from "./scripts/workspace.mts";
import { parseRecord } from "./scripts/review/lifecycle.mts";

// Browser evidence against the running review environment (npm run review:start),
// never a stack of its own: no webServer, nothing is started or reset. The global
// setup refuses a review that isn't at the expected commit or in this checkout.
const ws = workspace();
// Read lazily: tools load this file with no review running; the global setup then says so.
const recordFile = join(ws.workdir, "review.json");
const record = existsSync(recordFile) ? parseRecord(readFileSync(recordFile, "utf8")) : undefined;
const evidence = join(ws.workdir, "evidence");
process.env.E2E_STANDIN_PORT = String(ws.ports.reviewStandIn);

export default defineConfig({
  ...base,
  webServer: undefined,
  globalSetup: "./scripts/review/verify-target.mts",
  outputDir: join(evidence, "results"),
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: join(evidence, "report") }],
    ["./scripts/review/evidence-reporter.mts", { outputDir: evidence }],
  ],
  use: {
    ...base.use,
    baseURL: record?.url,
    screenshot: "on",
    // Traces hold the synthetic session's cookies; keep them only when something failed.
    trace: "retain-on-failure",
  },
});
