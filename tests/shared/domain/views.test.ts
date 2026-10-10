import { describe, expect, it } from "vitest";
import {
  compareWithAll,
  headToHead,
  heatmap,
  officialResult,
  opponentOf,
  rankings,
  type TeamTable,
} from "../../../shared/domain";
import { buildTeamTable } from "../../support/builders";
import { defined } from "../../support/defined";

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** Team 1 beats team 2 in every category; team 3 is level with team 2. */
const ladder = () =>
  buildTeamTable([
    { pts: 600, reb: 300, ast: 200, stl: 60, blk: 40, tpm: 90, to: 50, fgMakes: 260, ftMakes: 90 },
    { pts: 500, reb: 200, ast: 100, stl: 30, blk: 20, tpm: 50, to: 80 },
    { pts: 500, reb: 200, ast: 100, stl: 30, blk: 20, tpm: 50, to: 80 },
  ]);

describe("rankings", () => {
  it("orders teams by rank sum, best first", () => {
    const result = rankings(ladder());

    expect(result.map((team) => team.teamKey)).toEqual([
      "466.l.1.t.1",
      "466.l.1.t.2",
      "466.l.1.t.3",
    ]);
    expect(result[0]).toMatchObject({ rankSum: 9, position: 1 });
  });

  it("gives tied rank sums the same position and skips the next one (1, 1, 3)", () => {
    const result = rankings(ladder());

    expect(result.map((team) => team.position)).toEqual([1, 2, 2]);
    const reversed = rankings(
      buildTeamTable([{ pts: 100 }, { pts: 600 }, { pts: 600 }, { pts: 600 }])
    );
    expect(reversed.map((team) => team.position)).toEqual([1, 1, 1, 4]);
  });

  it("keeps the table's order among equal sums", () => {
    const table = buildTeamTable([{}, {}, {}]);
    expect(rankings(table).map((team) => team.teamKey)).toEqual([
      "466.l.1.t.1",
      "466.l.1.t.2",
      "466.l.1.t.3",
    ]);
  });

  it("puts teams with an unknown category last, without a sum or position", () => {
    const table = buildTeamTable([{ reb: null, pts: 900 }, { pts: 100 }, { pts: 200 }]);

    const result = rankings(table);

    expect(result.map((team) => team.teamKey)).toEqual([
      "466.l.1.t.3",
      "466.l.1.t.2",
      "466.l.1.t.1",
    ]);
    expect(result[2]).toMatchObject({ rankSum: null, position: null });
    expect(result[2].categoryRanks.reb).toBeNull();
    expect(result[2].categoryRanks.pts).toBe(1);
  });

  it("carries names and managers through", () => {
    const table = buildTeamTable([{}]);
    const named: TeamTable = {
      ...table,
      teams: [{ ...table.teams[0], teamName: "Hoops", managerName: "Sam" }],
    };
    expect(rankings(named)[0]).toMatchObject({ teamName: "Hoops", managerName: "Sam" });
  });
});

describe("heatmap", () => {
  it("gives each cell its value, rank and percentile", () => {
    const rows = heatmap(ladder());

    expect(rows.map((row) => row.teamKey)).toEqual(["466.l.1.t.1", "466.l.1.t.2", "466.l.1.t.3"]);
    expect(rows[0].cells.pts).toEqual({ value: 600, rank: 1, percentile: 100 });
    expect(rows[1].cells.pts).toEqual({ value: 500, rank: 2, percentile: (2 / 3) * 100 });
    expect(rows[2].cells.pts).toEqual({ value: 500, rank: 2, percentile: (2 / 3) * 100 });
  });

  it("ranks turnovers with the fewest as best", () => {
    const rows = heatmap(ladder());
    expect(rows[0].cells.to.rank).toBe(1);
    expect(rows[1].cells.to.rank).toBe(2);
  });

  it("computes percentage cells from makes and attempts", () => {
    const rows = heatmap(buildTeamTable([{ fgMakes: 50, fgAttempts: 100 }]));
    expect(rows[0].cells.fgPct.value).toBe(0.5);
  });

  it("leaves unknown cells unranked and bases percentiles on the teams that have a value", () => {
    const rows = heatmap(buildTeamTable([{ blk: null }, { blk: 5 }, { blk: 9 }]));

    expect(rows[0].cells.blk).toEqual({ value: null, rank: null, percentile: null });
    expect(rows[2].cells.blk).toEqual({ value: 9, rank: 1, percentile: 100 });
    expect(rows[1].cells.blk).toEqual({ value: 5, rank: 2, percentile: 50 });
  });
});

describe("headToHead", () => {
  it("scores each category from my team's side", () => {
    const result = headToHead(ladder(), "466.l.1.t.1", "466.l.1.t.2");

    expect(result?.score).toEqual({ wins: 9, losses: 0, ties: 0, unavailable: 0, complete: true });
    expect(result?.categories.find((c) => c.category === "pts")).toEqual({
      category: "pts",
      mine: 600,
      theirs: 500,
      difference: 100,
      result: "win",
    });
  });

  it("reverses the result when seen from the other side", () => {
    const result = headToHead(ladder(), "466.l.1.t.2", "466.l.1.t.1");
    expect(result?.score).toMatchObject({ wins: 0, losses: 9 });
  });

  it("counts equal values as ties", () => {
    const result = headToHead(ladder(), "466.l.1.t.2", "466.l.1.t.3");
    expect(result?.score).toMatchObject({ wins: 0, losses: 0, ties: 9, complete: true });
  });

  it("treats fewer turnovers as a win", () => {
    const table = buildTeamTable([{ to: 40 }, { to: 70 }]);
    const turnovers = headToHead(table, "466.l.1.t.1", "466.l.1.t.2")?.categories.find(
      (c) => c.category === "to"
    );
    expect(turnovers).toMatchObject({ result: "win", difference: -30 });
  });

  it("compares percentages exactly, so equal rounded percentages still have a winner", () => {
    // 0.4999 vs 0.5000: both display as 50.0%
    const table = buildTeamTable([
      { fgMakes: 4999, fgAttempts: 10000 },
      { fgMakes: 5000, fgAttempts: 10000 },
    ]);
    const fg = headToHead(table, "466.l.1.t.1", "466.l.1.t.2")?.categories[0];
    expect(fg?.result).toBe("loss");
  });

  it("claims no result where a value is unknown, and says the score is incomplete", () => {
    const table = buildTeamTable([{ ftMakes: 0, ftAttempts: 0, blk: null }, {}]);

    const result = headToHead(table, "466.l.1.t.1", "466.l.1.t.2");

    expect(result?.categories.find((c) => c.category === "ftPct")).toMatchObject({
      mine: null,
      difference: null,
      result: "unavailable",
    });
    expect(result?.categories.find((c) => c.category === "blk")?.result).toBe("unavailable");
    expect(result?.score).toMatchObject({ unavailable: 2, complete: false });
    const score = defined(result).score;
    expect(score.wins + score.losses + score.ties).toBe(7);
  });

  it("returns null when either team isn't in the table", () => {
    expect(headToHead(ladder(), "466.l.1.t.1", "nope")).toBeNull();
    expect(headToHead(ladder(), "nope", "466.l.1.t.1")).toBeNull();
  });
});

describe("compareWithAll", () => {
  it("compares my team against every other team in table order", () => {
    const results = compareWithAll(ladder(), "466.l.1.t.2");

    expect(results.map((result) => result.opponentTeamKey)).toEqual(["466.l.1.t.1", "466.l.1.t.3"]);
    expect(results.map((result) => result.score.wins)).toEqual([0, 0]);
  });

  it("is empty for a team that isn't in the table", () => {
    expect(compareWithAll(ladder(), "nope")).toEqual([]);
  });
});

describe("the official matchup", () => {
  const table = (pairings: TeamTable["pairings"]) => ({ ...ladder(), pairings });

  it("finds my opponent from Yahoo's pairings", () => {
    const withPairing = table([
      { teamKeys: ["466.l.1.t.1", "466.l.1.t.3"], winnerTeamKey: null, isTied: false },
    ]);
    expect(opponentOf(withPairing, "466.l.1.t.1")).toBe("466.l.1.t.3");
    expect(opponentOf(withPairing, "466.l.1.t.3")).toBe("466.l.1.t.1");
    expect(opponentOf(withPairing, "466.l.1.t.2")).toBeNull();
  });

  it("reports Yahoo's result rather than computing one", () => {
    const decided = table([
      { teamKeys: ["466.l.1.t.1", "466.l.1.t.2"], winnerTeamKey: "466.l.1.t.2", isTied: false },
    ]);
    expect(officialResult(decided, "466.l.1.t.1")).toBe("loss");
    expect(officialResult(decided, "466.l.1.t.2")).toBe("win");
  });

  it("reports ties, undecided weeks and unpaired teams", () => {
    const tied = table([
      { teamKeys: ["466.l.1.t.1", "466.l.1.t.2"], winnerTeamKey: null, isTied: true },
    ]);
    const live = table([
      { teamKeys: ["466.l.1.t.1", "466.l.1.t.2"], winnerTeamKey: null, isTied: false },
    ]);
    expect(officialResult(tied, "466.l.1.t.1")).toBe("tie");
    expect(officialResult(live, "466.l.1.t.1")).toBe("undecided");
    expect(officialResult(live, "466.l.1.t.3")).toBeNull();
  });
});

describe("purity", () => {
  it("never changes the table it is given", () => {
    const frozen = deepFreeze(ladder());

    expect(() => {
      rankings(frozen);
      heatmap(frozen);
      headToHead(frozen, "466.l.1.t.1", "466.l.1.t.2");
      compareWithAll(frozen, "466.l.1.t.1");
    }).not.toThrow();
  });

  it("gives the same answer every time", () => {
    const table = ladder();
    expect(rankings(table)).toEqual(rankings(table));
    expect(heatmap(table)).toEqual(heatmap(table));
  });
});
