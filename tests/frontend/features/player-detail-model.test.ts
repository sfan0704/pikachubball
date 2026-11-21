import { describe, expect, it } from "vitest";
import { measured, missing, missingLine, statOf } from "../../../shared/domain";
import {
  columnStatus,
  dayStatus,
  detailRows,
  gameStateText,
  lineOnDate,
  minutesText,
  opponentText,
  recentAndUpcoming,
  weekLine,
  yahooPlayerUrl,
  type LoggedGame,
} from "../../../client/src/features/daily-stats/player-detail-model";
import { buildStatLine, STANDARD_CATEGORIES, STAT, TEN_CATEGORIES } from "../../support/builders";

const TIP_OFF = "2026-11-11T23:30:00.000Z";

function game(date: string, overrides: Partial<LoggedGame> = {}): LoggedGame {
  return {
    gameId: `g-${date}`,
    date,
    opponent: "NYK",
    isHome: true,
    state: { kind: "final", tipOff: TIP_OFF, result: "W", ownScore: 110, opponentScore: 104 },
    minutes: measured(30),
    line: buildStatLine(),
    ...overrides,
  };
}

describe("player detail rows", () => {
  const season = {
    playerKey: "466.p.1",
    gamesPlayed: 10,
    line: buildStatLine({ fgm: 94, fga: 192, ftm: 30, fta: 40, pts: 215 }),
  };

  it("shows FG% with makes/attempts, and the average's per game", () => {
    const rows = detailRows(
      {
        lines: { today: buildStatLine(), yesterday: missingLine("noGame"), week: buildStatLine() },
        season,
      },
      STANDARD_CATEGORIES
    );
    const fg = rows.find((row) => row.key === STAT.fgPct);
    const pts = rows.find((row) => row.key === STAT.pts);

    expect(rows).toHaveLength(9);
    expect(fg?.cells.today).toEqual({ text: "46.2%", parts: "6/13" });
    expect(fg?.cells.season).toEqual({ text: "49.0%", parts: "9.4/19.2" });
    expect(pts?.cells.season.text).toBe("21.5");
    expect(pts?.cells.yesterday).toEqual({ text: "—", parts: null });
  });

  it("has a row for each of the league's own categories", () => {
    const rows = detailRows(
      {
        lines: { today: buildStatLine(), yesterday: buildStatLine(), week: buildStatLine() },
        season,
      },
      TEN_CATEGORIES
    );
    expect(rows.map((row) => row.key)).toEqual(TEN_CATEGORIES.map((c) => c.statId));
    expect(rows.find((row) => row.key === STAT.pf)?.cells.today.text).toBe("3");
    expect(rows.find((row) => row.key === STAT.tpPct)?.cells.today.parts).toBe("2/5");
  });

  it("never shows a missing or unplayed average as 0", () => {
    const rows = detailRows(
      {
        lines: {
          today: missingLine("didNotPlay"),
          yesterday: missingLine("notYetPlayed"),
          week: missingLine("unavailable"),
        },
        season: { ...season, gamesPlayed: 0 },
      },
      STANDARD_CATEGORIES
    );

    for (const row of rows) {
      expect(Object.values(row.cells).map((cell) => cell.text)).toEqual(["—", "—", "—", "—"]);
    }
  });
});

describe("player detail games", () => {
  const games = [
    game("2026-11-07"),
    game("2026-11-09", { minutes: missing("didNotPlay"), line: missingLine("didNotPlay") }),
    game("2026-11-11", {
      state: {
        kind: "live",
        tipOff: TIP_OFF,
        progress: { kind: "clock", period: 3, clock: "7:48", ownScore: 78, opponentScore: 74 },
      },
    }),
    game("2026-11-13", {
      isHome: false,
      state: { kind: "scheduled", tipOff: TIP_OFF },
      minutes: missing("notYetPlayed"),
      line: missingLine("notYetPlayed"),
    }),
  ];

  it("reads a date's line from the log, and no entry as no game", () => {
    expect(lineOnDate(games, "2026-11-07")).toEqual(buildStatLine());
    expect(lineOnDate(games, "2026-11-10")).toEqual(missingLine("noGame"));
  });

  it("adds the week's games and leaves a date outside the season unavailable", () => {
    const week = weekLine(games, { start: "2026-11-09", end: "2026-11-15" });

    expect(statOf(week, STAT.pts)).toEqual(measured(17));
    expect(weekLine(games, null)).toEqual(missingLine("unavailable"));
  });

  it("names each day's game state, a sat-out game and a day off", () => {
    expect(dayStatus(games, "2026-11-11")).toBe("Q3 7:48, 78-74");
    expect(dayStatus(games, "2026-11-09")).toBe("DNP");
    expect(dayStatus(games, "2026-11-10")).toBe("No game");
    expect(gameStateText(games[0].state)).toBe("W 110-104");
    expect(
      gameStateText({ kind: "live", tipOff: TIP_OFF, progress: { kind: "text", text: "Half" } })
    ).toBe("Half");
  });

  it("counts the week's played games and the season's GP under the headings", () => {
    const status = columnStatus(
      games,
      "2026-11-11",
      { start: "2026-11-09", end: "2026-11-15" },
      {
        playerKey: "466.p.1",
        gamesPlayed: 12,
        line: buildStatLine(),
      }
    );

    expect(status.week).toBe("1 GP");
    expect(status.season).toBe("12 GP");
    expect(columnStatus(games, "2026-11-11", null, null)).toMatchObject({ week: "—", season: "—" });
  });

  it("splits recent games, newest first, from today's and the next ones", () => {
    const { recent, upcoming } = recentAndUpcoming(games, "2026-11-11");

    expect(recent.map((entry) => entry.date)).toEqual(["2026-11-09", "2026-11-07"]);
    expect(upcoming.map((entry) => entry.date)).toEqual(["2026-11-11", "2026-11-13"]);
  });

  it("writes opponents, minutes and the Yahoo link the way the sheet shows them", () => {
    expect(opponentText(games[0])).toBe("vs NYK");
    expect(opponentText(games[3])).toBe("@ NYK");
    expect(minutesText(games[0])).toBe("30 min");
    expect(minutesText(games[1])).toBe("DNP");
    expect(minutesText(games[3])).toBe("");
  });

  it("rounds minutes from Yahoo's mm:ss to whole minutes", () => {
    // 34:23 and 7:55 as the game-log parser reads them.
    expect(minutesText(game("2026-11-05", { minutes: measured(34 + 23 / 60) }))).toBe("34 min");
    expect(minutesText(game("2026-11-05", { minutes: measured(7 + 55 / 60) }))).toBe("8 min");
    expect(yahooPlayerUrl("466.p.6014")).toBe("https://sports.yahoo.com/nba/players/6014/");
  });
});
