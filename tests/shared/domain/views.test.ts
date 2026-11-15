import { describe, expect, it } from "vitest";
import { compareCategories, opponentOf, type TeamTable } from "../../../shared/domain";
import {
  buildCategoryValues,
  buildTeamTable,
  CATEGORY,
  STANDARD_CATEGORIES,
  STAT,
} from "../../support/builders";
import { defined } from "../../support/defined";

/** Two teams of a table compared from the first one's side. */
function between(table: TeamTable, mine: string, theirs: string) {
  const values = (teamKey: string) =>
    defined(table.teams.find((team) => team.teamKey === teamKey)).categoryValues;
  return compareCategories(table.settings.categories, values(mine), values(theirs));
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
    { pts: 600, reb: 300, ast: 200, stl: 60, blk: 40, tpm: 90, to: 50, fgm: 260, ftm: 90 },
    { pts: 500, reb: 200, ast: 100, stl: 30, blk: 20, tpm: 50, to: 80 },
    { pts: 500, reb: 200, ast: 100, stl: 30, blk: 20, tpm: 50, to: 80 },
  ]);

describe("compareCategories", () => {
  it("scores two sets of counted values, such as one day's, with turnovers inverted", () => {
    const { categories, score } = compareCategories(
      STANDARD_CATEGORIES,
      buildCategoryValues({ pts: 120, to: 10, reb: 40 }),
      buildCategoryValues({ pts: 100, to: 12, reb: 40, ast: null })
    );
    expect(categories.find((c) => c.category.statId === STAT.pts)?.result).toBe("win");
    expect(categories.find((c) => c.category.statId === STAT.to)?.result).toBe("win");
    expect(categories.find((c) => c.category.statId === STAT.reb)?.result).toBe("tie");
    expect(categories.find((c) => c.category.statId === STAT.ast)?.result).toBe("unavailable");
    expect(score).toMatchObject({ wins: 2, ties: 6, unavailable: 1, complete: false });
  });
});

describe("compareCategories between two teams of a table", () => {
  it("scores each category from my team's side", () => {
    const result = between(ladder(), "466.l.1.t.1", "466.l.1.t.2");

    expect(result.score).toEqual({ wins: 9, losses: 0, ties: 0, unavailable: 0, complete: true });
    expect(result.categories.find((c) => c.category.statId === STAT.pts)).toEqual({
      category: CATEGORY.pts,
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
      (c) => c.category.statId === STAT.to
    );
    expect(turnovers).toMatchObject({ result: "win", difference: -30 });
  });

  it("compares percentages exactly, so equal rounded percentages still have a winner", () => {
    // 0.4999 vs 0.5000: both display as 50.0%
    const table = buildTeamTable([
      { fgm: 4999, fga: 10000 },
      { fgm: 5000, fga: 10000 },
    ]);
    const fg = between(table, "466.l.1.t.1", "466.l.1.t.2").categories[0];
    expect(fg?.result).toBe("loss");
  });

  it("claims no result where a value is unknown, and says the score is incomplete", () => {
    const table = buildTeamTable([{ ftm: 0, fta: 0, blk: null }, {}]);

    const result = between(table, "466.l.1.t.1", "466.l.1.t.2");

    expect(result.categories.find((c) => c.category.statId === STAT.ftPct)).toMatchObject({
      mine: null,
      difference: null,
      result: "unavailable",
    });
    expect(result.categories.find((c) => c.category.statId === STAT.blk)?.result).toBe(
      "unavailable"
    );
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
      between(frozen, "466.l.1.t.1", "466.l.1.t.2");
      opponentOf(frozen, "466.l.1.t.1");
    }).not.toThrow();
  });

  it("gives the same answer every time", () => {
    const table = ladder();
    expect(between(table, "466.l.1.t.1", "466.l.1.t.2")).toEqual(
      between(table, "466.l.1.t.1", "466.l.1.t.2")
    );
  });
});
