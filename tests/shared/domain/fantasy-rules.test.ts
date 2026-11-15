import { describe, expect, it } from "vitest";
import {
  categoryRanks,
  competitionRanks,
  percentage,
  rankSum,
  scoringSupport,
  tableCompleteness,
} from "../../../shared/domain";
import {
  buildLeagueSettings,
  buildTeamTable,
  CATEGORY,
  EIGHT_CATEGORIES,
  STAT,
} from "../../support/builders";

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

describe("categoryRanks", () => {
  it("ranks turnovers ascending and the other categories descending", () => {
    const table = buildTeamTable([
      { pts: 600, to: 80 },
      { pts: 500, to: 60 },
    ]);
    const ranks = categoryRanks(table);
    expect(ranks["466.l.1.t.1"][STAT.pts]).toBe(1);
    expect(ranks["466.l.1.t.2"][STAT.pts]).toBe(2);
    expect(ranks["466.l.1.t.1"][STAT.to]).toBe(2);
    expect(ranks["466.l.1.t.2"][STAT.to]).toBe(1);
  });

  it("ranks percentages by makes over attempts across the scope", () => {
    const table = buildTeamTable([
      { fgm: 40, fga: 100 },
      { fgm: 210, fga: 400 },
    ]);
    const ranks = categoryRanks(table);
    expect(ranks["466.l.1.t.2"][STAT.fgPct]).toBe(1);
    expect(ranks["466.l.1.t.1"][STAT.fgPct]).toBe(2);
  });

  it("leaves a team unranked in a category with zero attempts", () => {
    const ranks = categoryRanks(buildTeamTable([{ ftm: 0, fta: 0 }, {}]));
    expect(ranks["466.l.1.t.1"][STAT.ftPct]).toBeNull();
    expect(ranks["466.l.1.t.2"][STAT.ftPct]).toBe(1);
  });
});

describe("rankSum", () => {
  it("adds the league's category ranks, however many it has", () => {
    const ranks = categoryRanks(buildTeamTable([{}, {}]));
    expect(rankSum(ranks["466.l.1.t.1"])).toBe(9);
    const eight = buildTeamTable([{}, {}], {
      settings: buildLeagueSettings({ categories: EIGHT_CATEGORIES }),
    });
    expect(rankSum(categoryRanks(eight)["466.l.1.t.1"])).toBe(8);
  });

  it("is unavailable when any category rank is unknown", () => {
    const ranks = categoryRanks(buildTeamTable([{ reb: null }, {}]));
    expect(rankSum(ranks["466.l.1.t.1"])).toBeNull();
    expect(rankSum(ranks["466.l.1.t.2"])).toBe(9);
  });

  it("keeps tied sums tied", () => {
    const ranks = categoryRanks(
      buildTeamTable([
        { pts: 600, reb: 200 },
        { pts: 500, reb: 300 },
      ])
    );
    expect(rankSum(ranks["466.l.1.t.1"])).toBe(rankSum(ranks["466.l.1.t.2"]));
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
      categories: [...settings.categories.slice(0, 7), CATEGORY.mpg],
    });
    expect(support).toEqual({ supported: true });
  });

  it("supports the league's own directions", () => {
    const settings = buildLeagueSettings();
    const support = scoringSupport({
      ...settings,
      categories: settings.categories.map((category) =>
        category.statId === STAT.to ? { ...category, direction: "higher" as const } : category
      ),
    });
    expect(support).toEqual({ supported: true });
  });
});

describe("tableCompleteness", () => {
  const ZERO = {
    fgm: 0,
    fga: 0,
    ftm: 0,
    fta: 0,
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
