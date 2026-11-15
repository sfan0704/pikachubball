import { describe, expect, it } from "vitest";
import {
  categoryEntry,
  closestLostCategory,
  compareCategories,
  dayCallout,
  lineOf,
  measured,
  missing,
  missingLine,
  orderForCategory,
  type CategoryValues,
  type StatLine,
} from "../../../shared/domain";
import {
  buildCategoryValues,
  buildStatLine,
  CATEGORY,
  STANDARD_CATEGORIES,
  STAT,
} from "../../support/builders";

interface Row {
  readonly name: string;
  readonly isStartingSlot: boolean;
  readonly line: StatLine;
}

const row = (name: string, line: StatLine, isStartingSlot = true): Row => ({
  name,
  line,
  isStartingSlot,
});

function buildPlayerAverages(overrides: CategoryValues): CategoryValues {
  return {
    ...Object.fromEntries(STANDARD_CATEGORIES.map((category) => [category.statId, 1])),
    ...overrides,
  };
}

const names = (rows: readonly Row[]) => rows.map((r) => r.name);

const compare = (mine: CategoryValues, theirs: CategoryValues) =>
  compareCategories(STANDARD_CATEGORIES, mine, theirs);

describe("categoryEntry", () => {
  it("reads a count, a measured zero and a ratio with its two parts", () => {
    const line = buildStatLine({ blk: 0, fgm: 6, fga: 12 });
    expect(categoryEntry(line, CATEGORY.pts)).toEqual({ kind: "value", value: 17, parts: null });
    expect(categoryEntry(line, CATEGORY.blk)).toEqual({ kind: "value", value: 0, parts: null });
    expect(categoryEntry(line, CATEGORY.fgPct)).toEqual({
      kind: "value",
      value: 0.5,
      parts: { top: 6, bottom: 12 },
    });
  });

  it("builds any ratio from its parts, such as A/T and 3PT%", () => {
    const line = buildStatLine({ ast: 9, to: 3, tpm: 2, tpa: 8 });
    expect(categoryEntry(line, CATEGORY.astTo)).toMatchObject({ value: 3 });
    expect(categoryEntry(line, CATEGORY.tpPct)).toMatchObject({ value: 0.25 });
  });

  it("keeps 0/0 as measured with no value, and passes missing kinds through", () => {
    const line = buildStatLine({ ftm: 0, fta: 0, reb: missing("unavailable") });
    expect(categoryEntry(line, CATEGORY.ftPct)).toEqual({
      kind: "value",
      value: null,
      parts: { top: 0, bottom: 0 },
    });
    expect(categoryEntry(line, CATEGORY.reb)).toEqual({ kind: "unavailable" });
    expect(categoryEntry(missingLine("notYetPlayed"), CATEGORY.fgPct)).toEqual({
      kind: "notYetPlayed",
    });
  });

  it("is unavailable for a category the app can't build or a part Yahoo didn't send", () => {
    expect(categoryEntry(buildStatLine(), CATEGORY.mpg)).toEqual({ kind: "unavailable" });
    const withoutTurnovers = lineOf({ [STAT.ast]: measured(5) });
    expect(categoryEntry(withoutTurnovers, CATEGORY.astTo)).toEqual({ kind: "unavailable" });
    const halfMissing = lineOf({ [STAT.ast]: missing("noGame"), [STAT.to]: measured(1) });
    expect(categoryEntry(halfMissing, CATEGORY.astTo)).toEqual({ kind: "noGame" });
  });
});

describe("closestLostCategory", () => {
  it("opens on the lost category nearest to turning, relative to its size", () => {
    const mine = buildCategoryValues({ pts: 400, reb: 100, ast: 50 });
    const theirs = buildCategoryValues({ pts: 420, reb: 101, ast: 80 });
    expect(closestLostCategory(compare(mine, theirs))).toBe(CATEGORY.reb);
  });

  it("counts fewer turnovers as winning and falls back to the first category when nothing is lost", () => {
    const values = buildCategoryValues();
    expect(closestLostCategory(compare(values, values))).toBe(CATEGORY.fgPct);
    const lostOnTurnovers = compare(
      buildCategoryValues({ to: 30 }),
      buildCategoryValues({ to: 29 })
    );
    expect(closestLostCategory(lostOnTurnovers)).toBe(CATEGORY.to);
  });

  it("has nothing to open on in a league without categories", () => {
    expect(closestLostCategory(compareCategories([], {}, {}))).toBeNull();
  });
});

describe("orderForCategory", () => {
  const notYet = missingLine("notYetPlayed");
  it("puts counted slots first, then players who played, best first, ties in roster order", () => {
    const rows = [
      row("bench star", buildStatLine({ pts: 40 }), false),
      row("not started", notYet),
      row("ten", buildStatLine({ pts: 10 })),
      row("no game", missingLine("noGame")),
      row("thirty", buildStatLine({ pts: 30 })),
      row("unavailable", missingLine("unavailable")),
      row("sat out", missingLine("didNotPlay")),
      row("ten again", buildStatLine({ pts: 10 })),
    ];
    expect(names(orderForCategory(rows, CATEGORY.pts))).toEqual([
      "thirty",
      "ten",
      "ten again",
      "unavailable",
      "not started",
      "no game",
      "sat out",
      "bench star",
    ]);
  });

  it("sorts turnovers and fouls fewest first, percentages by attempts and A/T by value", () => {
    const few = row("few", buildStatLine({ to: 1, pf: 1, fgm: 9, fga: 10, ast: 2 }));
    const many = row("many", buildStatLine({ to: 5, pf: 4, fgm: 5, fga: 20, ast: 15 }));
    expect(names(orderForCategory([many, few], CATEGORY.to))).toEqual(["few", "many"]);
    expect(names(orderForCategory([many, few], CATEGORY.pf))).toEqual(["few", "many"]);
    expect(names(orderForCategory([few, many], CATEGORY.fgPct))).toEqual(["many", "few"]);
    expect(names(orderForCategory([many, few], CATEGORY.astTo))).toEqual(["many", "few"]);
  });

  it("keeps roster order among players who played while the categories are unknown", () => {
    const rows = [
      row("bench", buildStatLine({ pts: 40 }), false),
      row("no game", missingLine("noGame")),
      row("ten", buildStatLine({ pts: 10 })),
      row("thirty", buildStatLine({ pts: 30 })),
    ];
    expect(names(orderForCategory(rows, null))).toEqual(["ten", "thirty", "no game", "bench"]);
  });
});

describe("dayCallout", () => {
  const average = buildPlayerAverages({ [STAT.pts]: 20 });
  const entry = (pts: number) => categoryEntry(buildStatLine({ pts }), CATEGORY.pts);
  const pts = CATEGORY.pts;

  it("calls out values well above or below the average for counted players", () => {
    expect(dayCallout(pts, entry(30), average, true, false)).toBe("better");
    expect(dayCallout(pts, entry(10), average, true, false)).toBe("worse");
    expect(dayCallout(pts, entry(21), average, true, false)).toBe("usual");
  });

  it("never calls a live game worse, but does call it better", () => {
    expect(dayCallout(pts, entry(10), average, true, true)).toBe("usual");
    expect(dayCallout(pts, entry(30), average, true, true)).toBe("better");
  });

  it("says nothing for bench players, missing values or an unknown average", () => {
    expect(dayCallout(pts, entry(30), average, false, false)).toBe("unavailable");
    expect(dayCallout(pts, { kind: "notYetPlayed" }, average, true, false)).toBe("unavailable");
    expect(dayCallout(pts, entry(30), null, true, false)).toBe("unavailable");
    expect(dayCallout(CATEGORY.pf, entry(30), average, true, false)).toBe("unavailable");
  });
});
