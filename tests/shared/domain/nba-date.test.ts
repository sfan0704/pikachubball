import { describe, expect, it } from "vitest";
import { addDays, datesFrom, daysBetween, mondayOf, nbaDateOf } from "../../../shared/domain";

describe("fantasy dates", () => {
  it("lists every date of a range across a month end, both ends included", () => {
    expect(datesFrom("2026-11-29", "2026-12-02")).toEqual([
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
    expect(datesFrom("2026-11-29", "2026-11-29")).toEqual(["2026-11-29"]);
    expect(datesFrom("2026-11-30", "2026-11-29")).toEqual([]);
  });

  it("dates a moment in US Eastern time, so a late game is still that evening's date", () => {
    expect(nbaDateOf(Date.parse("2026-11-12T03:30:00Z"))).toBe("2026-11-11");
    expect(nbaDateOf(Date.parse("2026-11-12T05:30:00Z"))).toBe("2026-11-12");
  });

  it("follows daylight saving time", () => {
    expect(nbaDateOf(Date.parse("2026-07-01T03:30:00Z"))).toBe("2026-06-30");
    expect(nbaDateOf(Date.parse("2026-07-01T04:30:00Z"))).toBe("2026-07-01");
  });

  it("adds and counts days across month and year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2027-01-02", "2026-12-30")).toBe(-3);
  });

  it("finds the Monday a week starts on", () => {
    expect(mondayOf("2026-11-11")).toBe("2026-11-09");
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
  });
});
