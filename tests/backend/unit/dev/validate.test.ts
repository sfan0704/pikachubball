import { describe, expect, it } from "vitest";
import { passed, PROFILES, resolveChecks, type Result } from "../../../../scripts/validate.mts";

const result = (outcome: Result["outcome"]): Result => ({
  check: "lint",
  outcome,
  detail: "",
  seconds: 0,
});

describe("resolveChecks", () => {
  it("runs everything CI requires when no profile is named", () => {
    expect(resolveChecks([])).toEqual([
      "lint",
      "format",
      "knip",
      "types",
      "migrations",
      "unit",
      "build",
      "bundle",
      "database",
      "browser",
    ]);
  });

  it("covers each CI job's checks with the profiles that job runs", () => {
    expect(resolveChecks(["static", "unit", "build"])).toEqual([
      "lint",
      "format",
      "knip",
      "types",
      "migrations",
      "unit",
      "build",
      "bundle",
    ]);
    expect(resolveChecks(["database"])).toEqual(["database"]);
    expect(resolveChecks(["browser"])).toEqual(["build", "browser"]);
  });

  it("runs a check once however many profiles ask for it", () => {
    expect(resolveChecks(["build", "browser"])).toEqual(["build", "bundle", "browser"]);
  });

  it("keeps iterate fast and out of review", () => {
    expect(PROFILES.iterate).not.toContain("unit");
    expect(PROFILES.review).not.toContain("quick");
  });

  it("refuses an unknown profile instead of running nothing", () => {
    expect(() => resolveChecks(["everything"])).toThrow(/Unknown profile "everything"/);
  });
});

describe("passed", () => {
  it("passes only when every check ran and passed", () => {
    expect(passed([result("passed"), result("passed")])).toBe(true);
    expect(passed([result("passed"), result("failed")])).toBe(false);
  });

  it("never counts a missing prerequisite or a skipped check as a pass", () => {
    expect(passed([result("passed"), result("unavailable")])).toBe(false);
    expect(passed([result("passed"), result("not run")])).toBe(false);
    expect(passed([])).toBe(false);
  });
});
