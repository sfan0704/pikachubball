import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  averageThreshold,
  countedGames,
  countedTotals,
  expectedOver,
  gamesLeft,
  measured,
  missing,
  missingLine,
  perGameAverages,
  versusAverage,
  type PlayerDay,
  type StatLine,
} from "../../../shared/domain";
import { buildStatLine } from "../../support/builders";

const PG = { playerKey: "478.p.1", date: "2026-11-02", slot: "PG", isStartingSlot: true };
const BENCH = { playerKey: "478.p.2", date: "2026-11-02", slot: "BN", isStartingSlot: false };

function day(line: StatLine, overrides: Partial<PlayerDay> = {}): PlayerDay {
  return { ...PG, line, ...overrides };
}

describe("countedTotals", () => {
  it("sums starting-slot days and leaves bench and IL production out", () => {
    const totals = countedTotals([
      day(buildStatLine({ pts: measured(20), fg: measured({ makes: 8, attempts: 16 }) })),
      day(buildStatLine({ pts: measured(9), fg: measured({ makes: 4, attempts: 6 }) }), BENCH),
      day(buildStatLine({ pts: measured(5) }), { slot: "IL", isStartingSlot: false }),
    ]);
    expect(totals.pts).toBe(20);
    expect(totals.fgMakes).toBe(8);
    expect(totals.fgAttempts).toBe(16);
  });

  it("adds nothing for no game, did not play or not yet played, and never invents a zero", () => {
    const totals = countedTotals([
      day(buildStatLine({ reb: measured(7) })),
      day(missingLine("noGame")),
      day(missingLine("didNotPlay")),
      day(missingLine("notYetPlayed")),
    ]);
    expect(totals.reb).toBe(7);
  });

  it("makes a category unknown when a counted value is unavailable, and only that category", () => {
    const totals = countedTotals([
      day(buildStatLine({ ast: missing("unavailable"), ft: missing("unavailable") })),
      day(buildStatLine({ ast: measured(4) })),
    ]);
    expect(totals.ast).toBeNull();
    expect(totals.ftMakes).toBeNull();
    expect(totals.ftAttempts).toBeNull();
    expect(totals.pts).not.toBeNull();
  });

  it("ignores an unavailable value on the bench", () => {
    expect(countedTotals([day(missingLine("unavailable"), BENCH)]).pts).toBe(0);
  });

  it("sums makes and attempts, so FG% is total makes over total attempts", () => {
    const totals = countedTotals([
      day(buildStatLine({ fg: measured({ makes: 1, attempts: 1 }) })),
      day(buildStatLine({ fg: measured({ makes: 2, attempts: 9 }) })),
    ]);
    expect([totals.fgMakes, totals.fgAttempts]).toEqual([3, 10]);
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
  readonly fields: readonly (keyof StatLine)[];
  readonly yahooWeek: { readonly totals: object; readonly completedGames: number };
  readonly days: readonly {
    readonly date: string;
    readonly players: readonly { player: string; slot: string; stats: string[] }[];
  }[];
}

/** Yahoo's "-" is no game; anything else is a number or makes/attempts. */
function fromYahoo(raw: string) {
  if (raw === "-" || raw === "-/-") {
    return missing("noGame");
  }
  const [makes, attempts] = raw.split("/").map(Number);
  return attempts === undefined ? measured(makes) : measured({ makes, attempts });
}

function fan91Days(fixture: Fan91Fixture): PlayerDay[] {
  return fixture.days.flatMap(({ date, players }) =>
    players.map(({ player, slot, stats }) => ({
      playerKey: player,
      date,
      slot,
      isStartingSlot: slot !== "BN" && slot !== "IL",
      line: Object.fromEntries(
        fixture.fields.map((field, index) => [field, fromYahoo(stats[index])])
      ) as unknown as StatLine,
    }))
  );
}

describe("a FAN-91 team-week", () => {
  const fixture = JSON.parse(
    readFileSync("tests/shared/domain/fixtures/fan-91-team-week.json", "utf8")
  ) as Fan91Fixture;
  const days = fan91Days(fixture);

  it("reproduces Yahoo's week totals exactly from starting-slot days", () => {
    expect(countedTotals(days)).toEqual(fixture.yahooWeek.totals);
  });

  it("reproduces Yahoo's completed games", () => {
    expect(countedGames(days)).toBe(fixture.yahooWeek.completedGames);
  });
});

describe("perGameAverages", () => {
  it("divides counting totals by games played and keeps percentages as makes over attempts", () => {
    const averages = perGameAverages({
      gamesPlayed: 4,
      line: buildStatLine({ pts: measured(90), fg: measured({ makes: 30, attempts: 60 }) }),
    });
    expect(averages.pts).toBe(22.5);
    expect(averages.fgPct).toBe(0.5);
  });

  it("has no averages when no games were played", () => {
    const averages = perGameAverages({ gamesPlayed: 0, line: missingLine("didNotPlay") });
    expect(Object.values(averages).every((value) => value === null)).toBe(true);
  });

  it("leaves a category unknown when its total is missing, and FT% unknown with no attempts", () => {
    const averages = perGameAverages({
      gamesPlayed: 3,
      line: buildStatLine({ blk: missing("unavailable"), ft: measured({ makes: 0, attempts: 0 }) }),
    });
    expect(averages.blk).toBeNull();
    expect(averages.ftPct).toBeNull();
  });
});

describe("expectedOver", () => {
  it("scales counting stats by games and leaves percentages and unknowns alone", () => {
    const expected = expectedOver(
      { fgPct: 0.48, ftPct: null, tpm: 2, pts: 20, reb: 5, ast: 4, stl: 1, blk: 0.5, to: 2.5 },
      3
    );
    expect(expected).toEqual({
      fgPct: 0.48,
      ftPct: null,
      tpm: 6,
      pts: 60,
      reb: 15,
      ast: 12,
      stl: 3,
      blk: 1.5,
      to: 7.5,
    });
  });
});

describe("versusAverage", () => {
  it("uses .03 for percentages", () => {
    expect(averageThreshold("fgPct", 0.5)).toBe(0.03);
    expect(versusAverage("fgPct", 0.538, 0.508)).toBe("better");
    expect(versusAverage("fgPct", 0.52, 0.5)).toBe("usual");
    expect(versusAverage("ftPct", 0.7, 0.75)).toBe("worse");
  });

  it("uses 10% of the baseline for counting stats, but never less than 0.5", () => {
    expect(averageThreshold("pts", 20)).toBe(2);
    expect(averageThreshold("stl", 1.2)).toBe(0.5);
    expect(versusAverage("pts", 22, 20)).toBe("better");
    expect(versusAverage("pts", 21.9, 20)).toBe("usual");
    expect(versusAverage("stl", 0.6, 1.2)).toBe("worse");
    expect(versusAverage("stl", 0.8, 1.2)).toBe("usual");
  });

  it("treats fewer turnovers as better", () => {
    expect(versusAverage("to", 1, 3)).toBe("better");
    expect(versusAverage("to", 5, 3)).toBe("worse");
  });

  it("is unavailable when either side is unknown", () => {
    expect(versusAverage("reb", null, 8)).toBe("unavailable");
    expect(versusAverage("reb", 8, null)).toBe("unavailable");
  });
});

describe("gamesLeft", () => {
  it("is remaining games over remaining, live and completed games", () => {
    expect(gamesLeft({ remaining: 7, live: 1, completed: 31 })).toEqual({ left: 7, total: 39 });
    expect(gamesLeft({ remaining: 0, live: 0, completed: 44 })).toEqual({ left: 0, total: 44 });
  });
});
