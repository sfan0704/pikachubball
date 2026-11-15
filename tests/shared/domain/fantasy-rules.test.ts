import { describe, expect, it } from "vitest";
import {
  categoryValue,
  competitionRanks,
  percentage,
  scoringSupport,
  tableCompleteness,
} from "../../../shared/domain";
import { buildLeagueSettings, buildTeamTable, buildTeamTotals } from "../../support/builders";

describe("percentage", () => {
  it("divides total makes by total attempts", () => {
    expect(percentage(45, 100)).toBe(0.45);
  });

  it("is unavailable with zero attempts", () => {
    expect(percentage(0, 0)).toBeNull();
  });

  it("is unavailable when makes or attempts are unknown", () => {
    expect(percentage(null, 100)).toBeNull();
    expect(percentage(45, null)).toBeNull();
  });
});

describe("categoryValue", () => {
  it("computes FG% and FT% from makes and attempts, not stored percentages", () => {
    const totals = buildTeamTotals({ fgMakes: 50, fgAttempts: 100, ftMakes: 9, ftAttempts: 10 });
    expect(categoryValue(totals, "fgPct")).toBe(0.5);
    expect(categoryValue(totals, "ftPct")).toBe(0.9);
  });

  it("keeps a measured zero as zero and an unknown as null", () => {
    expect(categoryValue(buildTeamTotals({ blk: 0 }), "blk")).toBe(0);
    expect(categoryValue(buildTeamTotals({ blk: null }), "blk")).toBeNull();
  });
});

describe("competitionRanks", () => {
  it("gives tied values the same rank and skips the next rank (1, 1, 3)", () => {
    expect(competitionRanks([10, 10, 8], "higher")).toEqual([1, 1, 3]);
  });

  it("ranks the lowest value first when lower is better", () => {
    expect(competitionRanks([70, 55, 55, 90], "lower")).toEqual([3, 1, 1, 4]);
  });

  it("leaves unknown values unranked without affecting the others", () => {
    expect(competitionRanks([10, null, 8], "higher")).toEqual([1, null, 2]);
  });
});

describe("scoringSupport", () => {
  it("supports a standard nine-category head-to-head league", () => {
    expect(scoringSupport(buildLeagueSettings())).toEqual({ supported: true });
  });

  it("rejects points and rotisserie leagues", () => {
    for (const scoringType of ["point", "headpoint", "roto"]) {
      const support = scoringSupport(buildLeagueSettings({ scoringType }));
      expect(support.supported).toBe(false);
    }
  });

  it("supports any set of categories, including ones the app can't build", () => {
    const settings = buildLeagueSettings();
    const support = scoringSupport({
      ...settings,
      categories: [
        ...settings.categories.slice(0, 7),
        {
          statId: "26",
          key: null,
          displayName: "MPG",
          direction: "higher",
          makeup: { kind: "unavailable" },
        },
      ],
    });
    expect(support).toEqual({ supported: true });
  });

  it("supports the league's own directions", () => {
    const settings = buildLeagueSettings();
    const support = scoringSupport({
      ...settings,
      categories: settings.categories.map((category) =>
        category.key === "to" ? { ...category, direction: "higher" as const } : category
      ),
    });
    expect(support).toEqual({ supported: true });
  });
});

describe("tableCompleteness", () => {
  const ZERO = {
    fgMakes: 0,
    fgAttempts: 0,
    ftMakes: 0,
    ftAttempts: 0,
    tpm: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    to: 0,
  };

  it("is empty when no team has recorded anything, whether zero or unknown", () => {
    expect(tableCompleteness(buildTeamTable([ZERO, ZERO]))).toBe("empty");
    expect(tableCompleteness(buildTeamTable([ZERO, { ...ZERO, pts: null }]))).toBe("empty");
    expect(tableCompleteness(buildTeamTable([]))).toBe("empty");
  });

  it("is partial when stats exist but some value is unknown", () => {
    expect(tableCompleteness(buildTeamTable([{}, { pts: null }]))).toBe("partial");
  });

  it("is complete when every value is known, and a zero is a real value", () => {
    expect(tableCompleteness(buildTeamTable([{}, { blk: 0 }]))).toBe("complete");
  });
});
