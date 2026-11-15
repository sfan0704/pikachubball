import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  averageThreshold,
  countedGames,
  countedTotals,
  gamesPlayed,
  lineOf,
  measured,
  missing,
  missingLine,
  perGameAverages,
  versusAverage,
  type CountValue,
  type PlayerDay,
  type StatLine,
} from "../../../shared/domain";
import {
  buildStatLine,
  CATEGORY,
  EIGHT_CATEGORIES,
  STANDARD_CATEGORIES,
  STAT,
  TEN_CATEGORIES,
} from "../../support/builders";

const PG = { playerKey: "478.p.1", date: "2026-11-02", slot: "PG", isStartingSlot: true };
const BENCH = { playerKey: "478.p.2", date: "2026-11-02", slot: "BN", isStartingSlot: false };

function day(line: StatLine, overrides: Partial<PlayerDay> = {}): PlayerDay {
  return { ...PG, line, ...overrides };
}

/** Counted totals for the standard nine categories. */
const counted = (days: readonly PlayerDay[]) => countedTotals(days, STANDARD_CATEGORIES);

describe("countedTotals", () => {
  it("sums starting-slot days and leaves bench and IL production out", () => {
    const totals = counted([
      day(buildStatLine({ pts: 20, fgm: 8, fga: 16 })),
      day(buildStatLine({ pts: 9, fgm: 4, fga: 6 }), BENCH),
      day(buildStatLine({ pts: 5 }), { slot: "IL", isStartingSlot: false }),
    ]);
    expect(totals[STAT.pts]).toBe(20);
    expect(totals[STAT.fgm]).toBe(8);
    expect(totals[STAT.fga]).toBe(16);
  });

  it("covers exactly the stats the league's categories are built from", () => {
    expect(Object.keys(counted([])).sort()).toEqual(
      ["3", "4", "6", "7", "10", "12", "15", "16", "17", "18", "19"].sort()
    );
    expect(Object.keys(countedTotals([], TEN_CATEGORIES))).toContain(STAT.pf);
    expect(Object.keys(countedTotals([], TEN_CATEGORIES))).toContain(STAT.tpa);
    expect(countedTotals([], [CATEGORY.mpg])).toEqual({});
  });

  it("adds nothing for no game, did not play or not yet played, and never invents a zero", () => {
    const totals = counted([
      day(buildStatLine({ reb: 7 })),
      day(missingLine("noGame")),
      day(missingLine("didNotPlay")),
      day(missingLine("notYetPlayed")),
    ]);
    expect(totals[STAT.reb]).toBe(7);
  });

  it("makes a stat unknown when a counted value is unavailable, and only that stat", () => {
    const unavailable = missing("unavailable");
    const totals = counted([
      day(buildStatLine({ ast: unavailable, ftm: unavailable, fta: unavailable })),
      day(buildStatLine({ ast: 4 })),
    ]);
    expect(totals[STAT.ast]).toBeNull();
    expect(totals[STAT.ftm]).toBeNull();
    expect(totals[STAT.fta]).toBeNull();
    expect(totals[STAT.pts]).not.toBeNull();
  });

  it("makes a stat Yahoo didn't send unknown, never 0", () => {
    const withoutTurnovers = lineOf({ [STAT.ast]: measured(8) });
    const totals = countedTotals([day(withoutTurnovers)], EIGHT_CATEGORIES);
    expect(totals[STAT.ast]).toBe(8);
    expect(totals[STAT.to]).toBeNull();
  });

  it("ignores an unavailable value on the bench", () => {
    expect(counted([day(missingLine("unavailable"), BENCH)])[STAT.pts]).toBe(0);
  });

  it("sums makes and attempts, so FG% is total makes over total attempts", () => {
    const totals = counted([
      day(buildStatLine({ fgm: 1, fga: 1 })),
      day(buildStatLine({ fgm: 2, fga: 9 })),
    ]);
    expect([totals[STAT.fgm], totals[STAT.fga]]).toEqual([3, 10]);
  });
});

describe("countedGames", () => {
  it("counts starting-slot days with a played game, including a game the player sat out", () => {
    expect(
      countedGames([
        day(buildStatLine()),
        day(missingLine("didNotPlay")),
        day(missingLine("noGame")),
        day(missingLine("notYetPlayed")),
        day(missingLine("unavailable")),
        day(buildStatLine(), BENCH),
      ])
    ).toBe(2);
  });
});

interface Fan91Fixture {
  readonly fields: readonly string[];
  readonly yahooWeek: { readonly totals: object; readonly completedGames: number };
  readonly days: readonly {
    readonly date: string;
    readonly players: readonly { player: string; slot: string; stats: string[] }[];
  }[];
}

/** The fixture's field names as Yahoo stat ids; FG and FT are made/attempted pairs. */
const FIELD_STATS: Readonly<Record<string, readonly string[]>> = {
  fg: [STAT.fgm, STAT.fga],
  ft: [STAT.ftm, STAT.fta],
  tpm: [STAT.tpm],
  pts: [STAT.pts],
  reb: [STAT.reb],
  ast: [STAT.ast],
  stl: [STAT.stl],
  blk: [STAT.blk],
  to: [STAT.to],
};

/** The fixture's totals names as Yahoo stat ids. */
const TOTAL_STATS: Readonly<Record<string, string>> = {
  fgMakes: STAT.fgm,
  fgAttempts: STAT.fga,
  ftMakes: STAT.ftm,
  ftAttempts: STAT.fta,
  tpm: STAT.tpm,
  pts: STAT.pts,
  reb: STAT.reb,
  ast: STAT.ast,
  stl: STAT.stl,
  blk: STAT.blk,
  to: STAT.to,
};

/** Yahoo's "-" is no game; anything else is a number or makes/attempts. */
function fromYahoo(field: string, raw: string): [string, CountValue][] {
  const ids = FIELD_STATS[field];
  if (raw === "-" || raw === "-/-") {
    return ids.map((id) => [id, missing("noGame")]);
  }
  const values = raw.split("/").map(Number);
  return ids.map((id, index) => [id, measured(values[index])]);
}

function fan91Days(fixture: Fan91Fixture): PlayerDay[] {
  return fixture.days.flatMap(({ date, players }) =>
    players.map(({ player, slot, stats }) => ({
      playerKey: player,
      date,
      slot,
      isStartingSlot: slot !== "BN" && slot !== "IL",
      line: lineOf(
        Object.fromEntries(fixture.fields.flatMap((field, index) => fromYahoo(field, stats[index])))
      ),
    }))
  );
}

describe("a FAN-91 team-week", () => {
  const fixture = JSON.parse(
    readFileSync("tests/shared/domain/fixtures/fan-91-team-week.json", "utf8")
  ) as Fan91Fixture;
  const days = fan91Days(fixture);

  it("reproduces Yahoo's week totals exactly from starting-slot days", () => {
    const yahoo = Object.entries(fixture.yahooWeek.totals).map(([name, value]) => [
      TOTAL_STATS[name],
      value,
    ]);
    expect(counted(days)).toEqual(Object.fromEntries(yahoo));
  });

  it("reproduces Yahoo's completed games", () => {
    expect(countedGames(days)).toBe(fixture.yahooWeek.completedGames);
  });
});

describe("perGameAverages", () => {
  it("divides counting totals by games played and keeps percentages as makes over attempts", () => {
    const averages = perGameAverages(
      { gamesPlayed: 4, line: buildStatLine({ pts: 90, fgm: 30, fga: 60 }) },
      STANDARD_CATEGORIES
    );
    expect(averages[STAT.pts]).toBe(22.5);
    expect(averages[STAT.fgPct]).toBe(0.5);
  });

  it("averages each of the league's own categories, and none it can't build", () => {
    const period = {
      gamesPlayed: 2,
      line: buildStatLine({ ast: 10, to: 4, pf: 6, tpm: 3, tpa: 6 }),
    };
    expect(perGameAverages(period, EIGHT_CATEGORIES)[STAT.astTo]).toBe(2.5);
    expect(perGameAverages(period, TEN_CATEGORIES)[STAT.pf]).toBe(3);
    expect(perGameAverages(period, TEN_CATEGORIES)[STAT.tpPct]).toBe(0.5);
    expect(perGameAverages(period, [CATEGORY.mpg])).toEqual({ [STAT.mpg]: null });
  });

  it("has no averages when no games were played", () => {
    const averages = perGameAverages(
      { gamesPlayed: 0, line: missingLine("didNotPlay") },
      STANDARD_CATEGORIES
    );
    expect(Object.values(averages).every((value) => value === null)).toBe(true);
  });

  it("leaves a category unknown when its total is missing, and FT% unknown with no attempts", () => {
    const averages = perGameAverages(
      {
        gamesPlayed: 3,
        line: buildStatLine({ blk: missing("unavailable"), ftm: 0, fta: 0 }),
      },
      STANDARD_CATEGORIES
    );
    expect(averages[STAT.blk]).toBeNull();
    expect(averages[STAT.ftPct]).toBeNull();
  });
});

describe("versusAverage", () => {
  it("uses .03 for percentages", () => {
    expect(averageThreshold(CATEGORY.fgPct, 0.5)).toBe(0.03);
    expect(versusAverage(CATEGORY.fgPct, 0.538, 0.508)).toBe("better");
    expect(versusAverage(CATEGORY.fgPct, 0.52, 0.5)).toBe("usual");
    expect(versusAverage(CATEGORY.ftPct, 0.7, 0.75)).toBe("worse");
    expect(versusAverage(CATEGORY.tpPct, 0.3, 0.36)).toBe("worse");
  });

  it("uses 10% of the baseline for counting stats, but never less than 0.5", () => {
    expect(averageThreshold(CATEGORY.pts, 20)).toBe(2);
    expect(averageThreshold(CATEGORY.stl, 1.2)).toBe(0.5);
    expect(versusAverage(CATEGORY.pts, 22, 20)).toBe("better");
    expect(versusAverage(CATEGORY.pts, 21.9, 20)).toBe("usual");
    expect(versusAverage(CATEGORY.stl, 0.6, 1.2)).toBe("worse");
    expect(versusAverage(CATEGORY.stl, 0.8, 1.2)).toBe("usual");
  });

  it("uses 10% of the baseline for other ratios, but never less than 0.1", () => {
    expect(averageThreshold(CATEGORY.astTo, 3)).toBeCloseTo(0.3);
    expect(averageThreshold(CATEGORY.astTo, 0.5)).toBe(0.1);
    expect(versusAverage(CATEGORY.astTo, 3.5, 3)).toBe("better");
  });

  it("follows the category's direction: fewer turnovers and fouls are better", () => {
    expect(versusAverage(CATEGORY.to, 1, 3)).toBe("better");
    expect(versusAverage(CATEGORY.to, 5, 3)).toBe("worse");
    expect(versusAverage(CATEGORY.pf, 1, 3)).toBe("better");
  });

  it("is unavailable when either side is unknown", () => {
    expect(versusAverage(CATEGORY.reb, null, 8)).toBe("unavailable");
    expect(versusAverage(CATEGORY.reb, 8, null)).toBe("unavailable");
  });
});

describe("gamesPlayed", () => {
  it("is completed and live games over all the week's games, as Yahoo shows it", () => {
    expect(gamesPlayed({ remaining: 22, live: 0, completed: 19 })).toEqual({
      played: 19,
      total: 41,
    });
    expect(gamesPlayed({ remaining: 7, live: 1, completed: 31 })).toEqual({
      played: 32,
      total: 39,
    });
    expect(gamesPlayed({ remaining: 0, live: 0, completed: 44 })).toEqual({
      played: 44,
      total: 44,
    });
  });
});
