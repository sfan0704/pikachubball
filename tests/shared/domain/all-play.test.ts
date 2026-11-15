import { describe, expect, it } from "vitest";
import {
  competitionRanks,
  luckSteps,
  officialWeekRecords,
  seasonAllPlay,
  weeklyAllPlay,
  winPercentage,
  winPercentageRanks,
  type AllPlayTable,
  type MatchupPairing,
  type ScoringCategory,
  type TeamCategoryValues,
  type TeamRecord,
} from "../../../shared/domain";

const record = (wins: number, losses: number, ties: number): TeamRecord => ({
  wins,
  losses,
  ties,
});

const PTS: ScoringCategory = { statId: "12", direction: "higher" };
const TO: ScoringCategory = { statId: "19", direction: "lower" };
const FG: ScoringCategory = { statId: "5", direction: "higher" };

function team(teamKey: string, values: TeamCategoryValues["values"]): TeamCategoryValues {
  return { teamKey, values };
}

function pairing(a: string, b: string): MatchupPairing {
  return { teamKeys: [a, b], winnerTeamKey: null, isTied: false };
}

/** A league of the given shape: team i scores i + 1 in every category, and ids are not Yahoo's nine. */
function league(teamCount: number, categoryCount: number, lowerIds: readonly string[] = []) {
  const categories: ScoringCategory[] = Array.from({ length: categoryCount }, (_, index) => {
    const statId = `c${index}`;
    return { statId, direction: lowerIds.includes(statId) ? "lower" : "higher" };
  });
  const teams = Array.from({ length: teamCount }, (_, index) =>
    team(`t${index}`, Object.fromEntries(categories.map((c) => [c.statId, index + 1])))
  );
  return { categories, teams };
}

describe("weeklyAllPlay", () => {
  it("plays every team against every other team in each category", () => {
    const table = weeklyAllPlay(
      [PTS],
      [team("a", { "12": 600 }), team("b", { "12": 500 }), team("c", { "12": 400 })]
    );
    expect(table.a.total).toEqual(record(2, 0, 0));
    expect(table.b.total).toEqual(record(1, 1, 0));
    expect(table.c.total).toEqual(record(0, 2, 0));
  });

  it("counts equal values as a tie for both teams", () => {
    const table = weeklyAllPlay([PTS], [team("a", { "12": 500 }), team("b", { "12": 500 })]);
    expect(table.a.total).toEqual(record(0, 0, 1));
    expect(table.b.total).toEqual(record(0, 0, 1));
  });

  it("lets the lower value win a lower-is-better category", () => {
    const table = weeklyAllPlay([TO], [team("a", { "19": 60 }), team("b", { "19": 80 })]);
    expect(table.a.total).toEqual(record(1, 0, 0));
    expect(table.b.total).toEqual(record(0, 1, 0));
  });

  it("compares ratio categories by makes over attempts, not rounded percentages", () => {
    // 0.4651… against 0.4649…: both round to 46.5%, the exact ratio still decides.
    const table = weeklyAllPlay([FG], [team("a", { "5": 200 / 430 }), team("b", { "5": 33 / 71 })]);
    expect(table.a.total).toEqual(record(1, 0, 0));
  });

  it("skips a category whose value is missing or unknown instead of treating it as zero", () => {
    const table = weeklyAllPlay(
      [PTS, TO],
      [
        team("a", { "12": 500, "19": null }),
        team("b", { "12": 400 }),
        team("c", { "12": 0, "19": 70 }),
      ]
    );
    // TO: a is null and b has no value, so only c has a TO value and nobody gets a TO result.
    expect(table.a.total).toEqual(record(2, 0, 0));
    expect(table.b.total).toEqual(record(1, 1, 0));
    expect(table.c.total).toEqual(record(0, 2, 0));
    expect(table.c.byCategory["19"]).toEqual(record(0, 0, 0));
  });

  it("keeps a measured zero as a value that can win a lower-is-better category", () => {
    const table = weeklyAllPlay([TO], [team("a", { "19": 0 }), team("b", { "19": 5 })]);
    expect(table.a.total).toEqual(record(1, 0, 0));
  });

  it("gives 110 results per team in a league of 12 teams and 10 categories", () => {
    const { categories, teams } = league(12, 10, ["c9"]);
    const table = weeklyAllPlay(categories, teams);
    for (const key of Object.keys(table)) {
      const total = table[key].total;
      expect(total.wins + total.losses + total.ties).toBe(110);
      expect(Object.keys(table[key].byCategory)).toHaveLength(10);
    }
    // t11 has the most of everything: it wins the nine higher categories and loses the lower one.
    expect(table.t11.total).toEqual(record(99, 11, 0));
    expect(table.t0.total).toEqual(record(11, 99, 0));
    expect(table.t0.byCategory.c9).toEqual(record(11, 0, 0));
  });

  it("gives 56 results per team in a league of 8 teams and 8 categories", () => {
    const { categories, teams } = league(8, 8);
    const table = weeklyAllPlay(categories, teams);
    expect(table.t7.total).toEqual(record(56, 0, 0));
    expect(table.t3.total).toEqual(record(24, 32, 0));
    expect(Object.keys(table)).toHaveLength(8);
  });

  it("matches the category rank in each category on a single week", () => {
    const values = [5, 3, 3, 1, 4];
    const teams = values.map((value, index) => team(`t${index}`, { "12": value, "19": value }));
    const table = weeklyAllPlay([PTS, TO], teams);
    for (const category of [PTS, TO]) {
      const allPlayRanks = winPercentageRanks(
        Object.fromEntries(
          teams.map((t) => [t.teamKey, table[t.teamKey].byCategory[category.statId]])
        )
      );
      const categoryRanks = competitionRanks(values, category.direction);
      expect(teams.map((t) => allPlayRanks[t.teamKey])).toEqual(categoryRanks);
    }
  });
});

describe("seasonAllPlay", () => {
  const week = (total: TeamRecord): AllPlayTable => ({ a: { total, byCategory: { "12": total } } });

  it("adds the weekly records: 136–0–0 plus 100–36–0 is 236–36–0", () => {
    const season = seasonAllPlay([week(record(136, 0, 0)), week(record(100, 36, 0))]);
    expect(season.a.total).toEqual(record(236, 36, 0));
    expect(season.a.byCategory["12"]).toEqual(record(236, 36, 0));
  });

  it("never lets a margin carry over: a huge week counts the same as a narrow one", () => {
    const huge = weeklyAllPlay([PTS], [team("a", { "12": 900 }), team("b", { "12": 100 })]);
    const narrow = weeklyAllPlay([PTS], [team("a", { "12": 400 }), team("b", { "12": 401 })]);
    const season = seasonAllPlay([huge, narrow]);
    // Summed totals (method B) would give a 2–0; method A splits the weeks.
    expect(season.a.total).toEqual(record(1, 1, 0));
    expect(season.b.total).toEqual(record(1, 1, 0));
  });

  it("adds nothing for a team missing from a week", () => {
    const first = weeklyAllPlay([PTS], [team("a", { "12": 2 }), team("b", { "12": 1 })]);
    const second = weeklyAllPlay(
      [PTS],
      [team("a", { "12": 2 }), team("b", { "12": 1 }), team("c", { "12": 3 })]
    );
    const season = seasonAllPlay([first, second]);
    expect(season.a.total).toEqual(record(2, 1, 0));
    expect(season.c.total).toEqual(record(2, 0, 0));
  });

  it("is empty with no weeks", () => {
    expect(seasonAllPlay([])).toEqual({});
  });
});

describe("officialWeekRecords", () => {
  it("scores each team against its real opponent only", () => {
    const teams = [
      team("a", { "12": 500, "19": 60 }),
      team("b", { "12": 400, "19": 60 }),
      team("c", { "12": 900, "19": 10 }),
      team("d", { "12": 100, "19": 90 }),
    ];
    const records = officialWeekRecords([PTS, TO], teams, [pairing("a", "b"), pairing("c", "d")]);
    expect(records).toEqual({
      a: record(1, 0, 1),
      b: record(0, 1, 1),
      c: record(2, 0, 0),
      d: record(0, 2, 0),
    });
  });

  it("leaves out a missing category and a pairing with an unknown team", () => {
    const teams = [team("a", { "12": 500 }), team("b", { "12": 400, "19": 50 })];
    const records = officialWeekRecords([PTS, TO], teams, [pairing("a", "b"), pairing("x", "a")]);
    expect(records).toEqual({ a: record(1, 0, 0), b: record(0, 1, 0) });
  });
});

describe("winPercentage", () => {
  it("counts a tie as half a win", () => {
    expect(winPercentage(record(5, 3, 2))).toBe(0.6);
  });

  it("is unknown with no results", () => {
    expect(winPercentage(record(0, 0, 0))).toBeNull();
  });
});

describe("winPercentageRanks", () => {
  it("shares a rank for equal win % and skips the next (1, 1, 3)", () => {
    const ranks = winPercentageRanks({
      a: record(6, 3, 0),
      b: record(5, 2, 2),
      c: record(3, 6, 0),
      d: record(9, 0, 0),
    });
    // a and b are both 2/3; d is first.
    expect(ranks).toEqual({ d: 1, a: 2, b: 2, c: 4 });
  });

  it("gives no rank to a team with no results", () => {
    expect(winPercentageRanks({ a: record(1, 0, 0), b: record(0, 0, 0) })).toEqual({
      a: 1,
      b: null,
    });
  });
});

describe("luckSteps", () => {
  it("is real wins minus all-play win % times categories played", () => {
    // 50 official results: 30 wins + 4 ties as half = 32 real wins; all-play 0.5 × 50 = 25.
    const steps = luckSteps(record(30, 16, 4), record(60, 60, 0));
    expect(steps).toEqual({ realWins: 32, expectedWins: 25, luck: 7 });
  });

  it("counts all-play ties as half when judging strength", () => {
    // All-play (40 + 20/2) / 100 = 0.5; 9 official results with a tie: 4.5 real wins.
    const steps = luckSteps(record(4, 4, 1), record(40, 40, 20));
    expect(steps?.realWins).toBe(4.5);
    expect(steps?.expectedWins).toBeCloseTo(4.5);
    expect(steps?.luck).toBeCloseTo(0);
  });

  it("is negative for a strong team with a poor official record", () => {
    const steps = luckSteps(record(2, 7, 0), record(72, 9, 0));
    expect(steps?.expectedWins).toBeCloseTo(8);
    expect(steps?.luck).toBeCloseTo(-6);
  });

  it("is unknown when the team has no all-play results", () => {
    expect(luckSteps(record(5, 4, 0), record(0, 0, 0))).toBeNull();
  });
});
