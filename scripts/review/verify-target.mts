// Playwright global setup for `npm run review:evidence`: the evidence counts only
// if the review environment is this checkout's and serves the expected commit
// (EXPECTED_COMMIT, or HEAD). Anything else fails before a single test runs.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { workspace } from "../workspace.mts";
import { parseRecord } from "./lifecycle.mts";

/** Refuses a review that isn't this checkout's or isn't at the expected commit. */
export default async function verifyTarget(): Promise<void> {
  const ws = workspace();
  const file = join(ws.workdir, "review.json");
  if (!existsSync(file))
    throw new Error("No review is running here; run npm run review:start first");
  const record = parseRecord(readFileSync(file, "utf8"));
  const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const expected = process.env.EXPECTED_COMMIT ?? head;
  if (record.workspace !== ws.projectId) {
    throw new Error(
      `The review belongs to ${record.workspace}, not this checkout (${ws.projectId})`
    );
  }
  if (record.commit !== expected) {
    throw new Error(
      `The review is at ${record.commit.slice(0, 7)}, expected ${expected.slice(0, 7)}`
    );
  }
  const response = await fetch(`${record.url}/api/health`, { signal: AbortSignal.timeout(5000) });
  const body: unknown = await response.json();
  const served =
    typeof body === "object" && body !== null ? (body as { commit?: unknown }).commit : undefined;
  if (served !== expected) {
    throw new Error(`${record.url} serves ${String(served)}, expected ${expected}`);
  }
}
