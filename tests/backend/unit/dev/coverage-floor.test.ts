import { describe, expect, it } from "vitest";
import {
  floorProblems,
  parsePolicy,
  parseSummary,
  type FileCoverage,
  type FloorPolicy,
} from "../../../../scripts/coverage-floor.mts";

const floor = { lines: 80, branches: 75, functions: 80 };
const policy = (exceptions: string[] = [], over: Partial<typeof floor> = {}): FloorPolicy => ({
  floor: { ...floor, ...over },
  exceptions,
});
const file = (name: string, pct = 100, over: Partial<typeof floor> = {}): FileCoverage => ({
  file: name,
  lines: pct,
  branches: pct,
  functions: pct,
  ...over,
});

describe("floorProblems", () => {
  it("passes files at or above the floor on every measure", () => {
    expect(floorProblems([file("client/src/a.ts", 80, { branches: 75 })], policy(), null)).toEqual(
      []
    );
  });

  it("fails an untested file that isn't an exception, naming each measure below", () => {
    expect(floorProblems([file("client/src/new-helper.ts", 0)], policy(), null)).toEqual([
      "below floor  client/src/new-helper.ts: lines 0% < 80%, branches 0% < 75%, functions 0% < 80%",
    ]);
  });

  it("fails on a single measure below the floor", () => {
    const [problem] = floorProblems([file("server/x.ts", 100, { branches: 50 })], policy(), null);
    expect(problem).toBe("below floor  server/x.ts: branches 50% < 75%");
  });

  it("lets a listed exception stay below the floor", () => {
    const listed = policy(["server/index.ts"]);
    expect(floorProblems([file("server/index.ts", 0)], listed, listed)).toEqual([]);
  });

  it("makes a listed file that now meets the floor come off the list", () => {
    const listed = policy(["server/app.ts"]);
    expect(floorProblems([file("server/app.ts")], listed, listed)).toEqual([
      "meets floor  server/app.ts: remove it from tests/coverage-floor.json",
    ]);
  });

  it("refuses an exception the base branch doesn't list", () => {
    const problems = floorProblems(
      [file("client/src/new-helper.ts", 0)],
      policy(["client/src/new-helper.ts"]),
      policy()
    );
    expect(problems).toEqual([
      "new          client/src/new-helper.ts: the exception list only shrinks; add tests instead",
    ]);
  });

  it("flags an exception that is no longer measured", () => {
    const listed = policy(["client/src/gone.ts"]);
    expect(floorProblems([], listed, listed)).toEqual([
      "stale        client/src/gone.ts: not measured; remove it from tests/coverage-floor.json",
    ]);
  });

  it("refuses a floor lower than the base branch's", () => {
    expect(floorProblems([], policy([], { branches: 60 }), policy())).toEqual([
      "lowered      floor.branches 60% < 75% on the base",
    ]);
  });

  it("skips the base comparisons when the base has no policy yet", () => {
    const listed = policy(["server/index.ts"], { lines: 10 });
    expect(floorProblems([file("server/index.ts", 0)], listed, null)).toEqual([]);
  });
});

describe("parsePolicy", () => {
  it("reads the floor and the exceptions", () => {
    expect(parsePolicy(JSON.stringify(policy(["a.ts"])))).toEqual(policy(["a.ts"]));
  });

  it("refuses a policy missing a measure or with a malformed list", () => {
    expect(() => parsePolicy(JSON.stringify({ floor: { lines: 80 }, exceptions: [] }))).toThrow(
      "floor.branches is not a number"
    );
    expect(() => parsePolicy(JSON.stringify({ floor, exceptions: [1] }))).toThrow(
      "exceptions is not a list of paths"
    );
    expect(() => parsePolicy("null")).toThrow("policy is not an object");
    expect(() => parsePolicy("{}")).toThrow("policy has no floor");
  });
});

describe("parseSummary", () => {
  const metrics = (pct: number) => ({
    lines: { pct },
    branches: { pct },
    functions: { pct },
    statements: { pct },
  });

  it("keeps client and server files, relative to the root, and drops the total", () => {
    const summary = JSON.stringify({
      total: metrics(90),
      "/repo/client/src/a.ts": metrics(50),
      "/repo/server/b.ts": metrics(100),
      "/repo/shared/domain/c.ts": metrics(10),
    });
    expect(parseSummary(summary, "/repo")).toEqual([
      file("client/src/a.ts", 50),
      file("server/b.ts"),
    ]);
  });
});
