import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  categoryEntry,
  closestLostCategory,
  compareTotals,
  dayCallout,
  measured,
  missing,
  missingLine,
  orderForCategory,
  type CategoryValues,
  type StatLine,
} from "../../../shared/domain";
import { buildStatLine, buildTeamTotals } from "../../support/builders";

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

function buildPlayerAverages(overrides: Partial<CategoryValues>): CategoryValues {
  return {
    ...Object.fromEntries(CATEGORIES.map((key) => [key, 1])),
    ...overrides,
  } as CategoryValues;
}

const names = (rows: readonly Row[]) => rows.map((r) => r.name);

describe("categoryEntry", () => {
  it("reads a count, a measured zero and a shooting line with its makes and attempts", () => {
    const line = buildStatLine({ blk: measured(0), fg: measured({ makes: 6, attempts: 12 }) });
    expect(categoryEntry(line, "pts")).toEqual({ kind: "value", value: 17, shots: null });
    expect(categoryEntry(line, "blk")).toEqual({ kind: "value", value: 0, shots: null });
    expect(categoryEntry(line, "fgPct")).toEqual({
      kind: "value",
      value: 0.5,
      shots: { makes: 6, attempts: 12 },
    });
  });

  it("keeps 0/0 shooting as measured with no percentage, and passes missing kinds through", () => {
    const line = buildStatLine({
      ft: measured({ makes: 0, attempts: 0 }),
      reb: missing("unavailable"),
    });
    expect(categoryEntry(line, "ftPct")).toEqual({
      kind: "value",
      value: null,
      shots: { makes: 0, attempts: 0 },
    });
    expect(categoryEntry(line, "reb")).toEqual({ kind: "unavailable" });
    expect(categoryEntry(missingLine("notYetPlayed"), "fgPct")).toEqual({ kind: "notYetPlayed" });
  });
});

describe("closestLostCategory", () => {
  it("opens on the lost category nearest to turning, relative to its size", () => {
    const mine = buildTeamTotals({ pts: 400, reb: 100, ast: 50 });
    const theirs = buildTeamTotals({ pts: 420, reb: 101, ast: 80 });
    expect(closestLostCategory(compareTotals(mine, theirs))).toBe("reb");
  });

  it("counts fewer turnovers as winning and falls back to the first category when nothing is lost", () => {
    const totals = buildTeamTotals();
    expect(closestLostCategory(compareTotals(totals, totals))).toBe("fgPct");
    const lostOnTurnovers = compareTotals(buildTeamTotals({ to: 30 }), buildTeamTotals({ to: 29 }));
    expect(closestLostCategory(lostOnTurnovers)).toBe("to");
  });
});

describe("orderForCategory", () => {
  const notYet = missingLine("notYetPlayed");
  it("puts counted slots first, then players who played, best first, ties in roster order", () => {
    const rows = [
      row("bench star", buildStatLine({ pts: measured(40) }), false),
      row("not started", notYet),
      row("ten", buildStatLine({ pts: measured(10) })),
      row("no game", missingLine("noGame")),
      row("thirty", buildStatLine({ pts: measured(30) })),
      row("unavailable", missingLine("unavailable")),
      row("sat out", missingLine("didNotPlay")),
      row("ten again", buildStatLine({ pts: measured(10) })),
    ];
    expect(names(orderForCategory(rows, "pts"))).toEqual([
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

  it("sorts turnovers fewest first and shooting by attempts", () => {
    const few = row(
      "few",
      buildStatLine({ to: measured(1), fg: measured({ makes: 9, attempts: 10 }) })
    );
    const many = row(
      "many",
      buildStatLine({ to: measured(5), fg: measured({ makes: 5, attempts: 20 }) })
    );
    expect(names(orderForCategory([many, few], "to"))).toEqual(["few", "many"]);
    expect(names(orderForCategory([few, many], "fgPct"))).toEqual(["many", "few"]);
  });
});

describe("dayCallout", () => {
  const average = buildPlayerAverages({ pts: 20 });
  const entry = (pts: number) => categoryEntry(buildStatLine({ pts: measured(pts) }), "pts");

  it("calls out values well above or below the average for counted players", () => {
    expect(dayCallout("pts", entry(30), average, true, false)).toBe("better");
    expect(dayCallout("pts", entry(10), average, true, false)).toBe("worse");
    expect(dayCallout("pts", entry(21), average, true, false)).toBe("usual");
  });

  it("never calls a live game worse, but does call it better", () => {
    expect(dayCallout("pts", entry(10), average, true, true)).toBe("usual");
    expect(dayCallout("pts", entry(30), average, true, true)).toBe("better");
  });

  it("says nothing for bench players, missing values or an unknown average", () => {
    expect(dayCallout("pts", entry(30), average, false, false)).toBe("unavailable");
    expect(dayCallout("pts", { kind: "notYetPlayed" }, average, true, false)).toBe("unavailable");
    expect(dayCallout("pts", entry(30), null, true, false)).toBe("unavailable");
  });
});
