import { describe, expect, it } from "vitest";
import { compareTotals, opponentOf, rankings, type TeamTable } from "../../../shared/domain";
import { buildTeamTable, buildTeamTotals } from "../../support/builders";
import { defined } from "../../support/defined";

/** Two teams of a table compared from the first one's side. */
function between(table: TeamTable, mine: string, theirs: string) {
  const totals = (teamKey: string) =>
    defined(table.teams.find((team) => team.teamKey === teamKey)).totals;
  return compareTotals(totals(mine), totals(theirs));
}

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

describe("compareTotals", () => {
  it("scores two sets of counted totals, such as one day's, with turnovers inverted", () => {
    const { categories, score } = compareTotals(
      buildTeamTotals({ pts: 120, to: 10, reb: 40 }),
      buildTeamTotals({ pts: 100, to: 12, reb: 40, ast: null })
    );
    expect(categories.find((c) => c.category === "pts")?.result).toBe("win");
    expect(categories.find((c) => c.category === "to")?.result).toBe("win");
    expect(categories.find((c) => c.category === "reb")?.result).toBe("tie");
    expect(categories.find((c) => c.category === "ast")?.result).toBe("unavailable");
    expect(score).toMatchObject({ wins: 2, ties: 6, unavailable: 1, complete: false });
  });
});

describe("compareTotals between two teams of a table", () => {
  it("scores each category from my team's side", () => {
    const result = between(ladder(), "466.l.1.t.1", "466.l.1.t.2");

    expect(result.score).toEqual({ wins: 9, losses: 0, ties: 0, unavailable: 0, complete: true });
    expect(result.categories.find((c) => c.category === "pts")).toEqual({
      category: "pts",
      mine: 600,
      theirs: 500,
      difference: 100,
      result: "win",
    });
  });

  it("reverses the result when seen from the other side", () => {
    const result = between(ladder(), "466.l.1.t.2", "466.l.1.t.1");
    expect(result.score).toMatchObject({ wins: 0, losses: 9 });
  });

  it("counts equal values as ties", () => {
    const result = between(ladder(), "466.l.1.t.2", "466.l.1.t.3");
    expect(result.score).toMatchObject({ wins: 0, losses: 0, ties: 9, complete: true });
  });

  it("treats fewer turnovers as a win", () => {
    const table = buildTeamTable([{ to: 40 }, { to: 70 }]);
    const turnovers = between(table, "466.l.1.t.1", "466.l.1.t.2").categories.find(
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
    const fg = between(table, "466.l.1.t.1", "466.l.1.t.2").categories[0];
    expect(fg?.result).toBe("loss");
  });

  it("claims no result where a value is unknown, and says the score is incomplete", () => {
    const table = buildTeamTable([{ ftMakes: 0, ftAttempts: 0, blk: null }, {}]);

    const result = between(table, "466.l.1.t.1", "466.l.1.t.2");

    expect(result.categories.find((c) => c.category === "ftPct")).toMatchObject({
      mine: null,
      difference: null,
      result: "unavailable",
    });
    expect(result.categories.find((c) => c.category === "blk")?.result).toBe("unavailable");
    expect(result.score).toMatchObject({ unavailable: 2, complete: false });
    const score = defined(result).score;
    expect(score.wins + score.losses + score.ties).toBe(7);
  });
});

describe("the matchup pairing", () => {
  const table = (pairings: TeamTable["pairings"]) => ({ ...ladder(), pairings });

  it("finds my opponent from Yahoo's pairings", () => {
    const withPairing = table([
      { teamKeys: ["466.l.1.t.1", "466.l.1.t.3"], winnerTeamKey: null, isTied: false },
    ]);
    expect(opponentOf(withPairing, "466.l.1.t.1")).toBe("466.l.1.t.3");
    expect(opponentOf(withPairing, "466.l.1.t.3")).toBe("466.l.1.t.1");
    expect(opponentOf(withPairing, "466.l.1.t.2")).toBeNull();
  });
});

describe("purity", () => {
  it("never changes the table it is given", () => {
    const frozen = deepFreeze(ladder());

    expect(() => {
      rankings(frozen);
      opponentOf(frozen, "466.l.1.t.1");
    }).not.toThrow();
  });

  it("gives the same answer every time", () => {
    const table = ladder();
    expect(rankings(table)).toEqual(rankings(table));
  });
});
