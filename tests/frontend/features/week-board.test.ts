import { describe, expect, it } from "vitest";
import {
  weekFor,
  weekLabel,
  type ScoringWeek,
} from "../../../client/src/features/daily-stats/week-board";

const weeks: readonly ScoringWeek[] = [
  { week: 1, start: "2026-11-02", end: "2026-11-08" },
  { week: 2, start: "2026-11-09", end: "2026-11-15" },
  { week: 3, start: "2026-11-16", end: "2026-11-22" },
];

describe("weekLabel", () => {
  it("shows the month once when the week stays in one month", () => {
    expect(weekLabel({ week: 4, start: "2026-11-02", end: "2026-11-08" })).toBe("Week 4 · Nov 2–8");
  });

  it("shows both months when the week crosses a month", () => {
    expect(weekLabel({ week: 3, start: "2026-10-26", end: "2026-11-01" })).toBe(
      "Week 3 · Oct 26–Nov 1"
    );
  });

  it("shows both months when the week crosses the year", () => {
    expect(weekLabel({ week: 18, start: "2026-12-28", end: "2027-01-03" })).toBe(
      "Week 18 · Dec 28–Jan 3"
    );
  });
});

describe("weekFor", () => {
  it("finds the week holding today for the current scope", () => {
    expect(weekFor(weeks, "current", "2026-11-11")).toEqual(weeks[1]);
  });

  it("includes the start and end days of a week", () => {
    expect(weekFor(weeks, "current", "2026-11-09")).toEqual(weeks[1]);
    expect(weekFor(weeks, "current", "2026-11-15")).toEqual(weeks[1]);
  });

  it("returns undefined when today falls in no week", () => {
    expect(weekFor(weeks, "current", "2026-11-01")).toBeUndefined();
    expect(weekFor(weeks, "current", "2026-11-23")).toBeUndefined();
  });

  it("finds a week by number and returns undefined when it is missing", () => {
    expect(weekFor(weeks, 2, "2026-11-11")).toEqual(weeks[1]);
    expect(weekFor(weeks, 99, "2026-11-11")).toBeUndefined();
  });
});
