import { describe, expect, it } from "vitest";
import {
  countedGamesLabel,
  countedTotals,
  elapsedDates,
  missingLine,
  orderWeekPlayers,
  weekParts,
  weekPlayers,
  weekValue,
  type PlayerDay,
  type StatLine,
} from "../../../shared/domain";
import { buildStatLine, CATEGORY, STANDARD_CATEGORIES, STAT } from "../../support/builders";

const WEEK = { start: "2026-11-02", end: "2026-11-08" };

function day(
  playerKey: string,
  date: string,
  isStartingSlot: boolean,
  line: StatLine = buildStatLine()
): PlayerDay {
  return { playerKey, date, slot: isStartingSlot ? "PG" : "BN", isStartingSlot, line };
}

const points = (pts: number) => buildStatLine({ pts });

describe("elapsedDates", () => {
  it("lists the week's dates up to today", () => {
    expect(elapsedDates(WEEK, "2026-11-04")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
  });

  it("lists every date of a finished week and none before it starts", () => {
    expect(elapsedDates(WEEK, "2026-11-20")).toHaveLength(7);
    expect(elapsedDates(WEEK, "2026-11-01")).toEqual([]);
  });
});

describe("weekPlayers", () => {
  const days: PlayerDay[] = [
    // Starter all three days, one with no game.
    day("a", "2026-11-02", true, points(10)),
    day("a", "2026-11-03", true, missingLine("noGame")),
    day("a", "2026-11-04", true, points(20)),
    // Dropped after Tuesday.
    day("d", "2026-11-02", true, points(7)),
    day("d", "2026-11-03", true, points(3)),
    // Added Wednesday.
    day("n", "2026-11-04", true, points(12)),
    // Benched once, started once.
    day("p", "2026-11-02", false, points(30)),
    day("p", "2026-11-04", true, points(8)),
    // Benched for both of their games.
    day("b", "2026-11-02", false, points(25)),
    day("b", "2026-11-03", false, points(25)),
    day("b", "2026-11-04", false, missingLine("noGame")),
  ];
  const players = weekPlayers(days, WEEK, new Set(["a"]), STANDARD_CATEGORIES);
  const byKey = (key: string) => {
    const found = players.find((player) => player.playerKey === key);
    if (!found) {
      throw new Error(`no player ${key}`);
    }
    return found;
  };

  it("keeps roster order and groups the dropped and those out now", () => {
    expect(players.map((player) => [player.playerKey, player.group])).toEqual([
      ["a", "out"],
      ["d", "dropped"],
      ["n", "roster"],
      ["p", "roster"],
      ["b", "roster"],
    ]);
  });

  it("dates adds and drops within the week", () => {
    expect(byKey("n").addedOn).toBe("2026-11-04");
    expect(byKey("d").droppedAfter).toBe("2026-11-03");
    expect(byKey("a")).toMatchObject({ addedOn: null, droppedAfter: null });
  });

  it("counts only starting-slot games toward a player's totals", () => {
    expect(byKey("p")).toMatchObject({ games: 2, countedGames: 1 });
    expect(byKey("p").totals[STAT.pts]).toBe(8);
    expect(byKey("a")).toMatchObject({ games: 2, countedGames: 2 });
    expect(byKey("a").totals[STAT.pts]).toBe(30);
  });

  it("adds up to the team's counted totals", () => {
    const sum = players.reduce((total, player) => total + (player.totals[STAT.pts] ?? 0), 0);
    expect(sum).toBe(countedTotals(days, STANDARD_CATEGORIES)[STAT.pts]);
  });

  it("labels partly and fully benched players, and nobody else", () => {
    expect(countedGamesLabel(byKey("p"))).toBe("1 of 2 G counted");
    expect(countedGamesLabel(byKey("b"))).toBe("Benched");
    expect(countedGamesLabel(byKey("a"))).toBeNull();
  });

  it("shows no value for a player whose games never counted, never a 0", () => {
    expect(weekValue(byKey("b"), CATEGORY.pts)).toBeNull();
    expect(weekValue(byKey("p"), CATEGORY.pts)).toBe(8);
  });

  it("orders contributors best first and the rest after, keeping roster order", () => {
    const ordered = orderWeekPlayers(players, CATEGORY.pts).map((player) => player.playerKey);
    expect(ordered).toEqual(["a", "n", "d", "p", "b"]);
  });

  it("gives a ratio's counted parts, and none for counts or players who added nothing", () => {
    expect(weekParts(byKey("a"), CATEGORY.fgPct)).toEqual({ top: 12, bottom: 26 });
    expect(weekParts(byKey("a"), CATEGORY.pts)).toBeNull();
    expect(weekParts(byKey("b"), CATEGORY.fgPct)).toBeNull();
  });

  it("orders a percentage by attempts and turnovers fewest first", () => {
    const byAttempts = orderWeekPlayers(players, CATEGORY.fgPct).map((p) => p.playerKey);
    expect(byAttempts.slice(0, 1)).toEqual(["a"]);
    const byTurnovers = orderWeekPlayers(players, CATEGORY.to).map((p) => p.playerKey);
    expect(byTurnovers.at(-1)).toBe("b");
  });

  it("keeps roster order while the categories are unknown", () => {
    const ordered = orderWeekPlayers(players, null).map((player) => player.playerKey);
    expect(ordered).toEqual(players.map((player) => player.playerKey));
  });
});
