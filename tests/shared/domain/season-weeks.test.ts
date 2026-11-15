import { describe, expect, it } from "vitest";
import { seasonWeekScopes } from "../../../shared/domain";

describe("seasonWeekScopes", () => {
  it("lists each finished week by number, then the week in progress", () => {
    expect(seasonWeekScopes({ startWeek: 1, currentWeek: 4 })).toEqual([1, 2, 3, "current"]);
    expect(seasonWeekScopes({ startWeek: 3, currentWeek: 5 })).toEqual([3, 4, "current"]);
  });

  it("is only the week in progress in the first week", () => {
    expect(seasonWeekScopes({ startWeek: 1, currentWeek: 1 })).toEqual(["current"]);
  });
});
