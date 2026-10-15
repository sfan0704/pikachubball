import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("production smoke failure summary", () => {
  it("writes owner recovery instructions and a clickable runbook to the job summary", () => {
    const directory = mkdtempSync(join(tmpdir(), "smoke-summary-"));
    const summary = join(directory, "job summary.md");
    try {
      execFileSync("bash", ["scripts/smoke-failure-summary.sh"], {
        env: {
          ...process.env,
          GITHUB_STEP_SUMMARY: summary,
          GITHUB_REPOSITORY: "sfan0704/pikachubball",
        },
      });
      const output = readFileSync(summary, "utf8");
      expect(output).toContain("The owner must inspect the failed checks");
      expect(output).toContain(
        "https://github.com/sfan0704/pikachubball/blob/main/docs/runbooks/restore-and-rollback.md"
      );
      expect(output).toContain("does not change production traffic or the database");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("refuses to silently omit evidence when the summary destination is unavailable", () => {
    expect(() =>
      execFileSync("bash", ["scripts/smoke-failure-summary.sh"], {
        env: {
          ...process.env,
          GITHUB_STEP_SUMMARY: "",
          GITHUB_REPOSITORY: "sfan0704/pikachubball",
        },
        stdio: "pipe",
      })
    ).toThrow();
  });
});
