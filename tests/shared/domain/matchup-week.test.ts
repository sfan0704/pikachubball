import { describe, expect, it } from "vitest";
import {
  countedGamesLabel,
  countedTotals,
  elapsedDates,
  measured,
  missingLine,
  orderWeekPlayers,
  weekPlayers,
  weekValue,
  type PlayerDay,
  type StatLine,
} from "../../../shared/domain";
import { buildStatLine } from "../../support/builders";

const WEEK = { start: "2026-11-02", end: "2026-11-08" };

function day(
  playerKey: string,
  date: string,
  isStartingSlot: boolean,
  line: StatLine = buildStatLine()
): PlayerDay {
  return { playerKey, date, slot: isStartingSlot ? "PG" : "BN", isStartingSlot, line };
}

const points = (pts: number) => buildStatLine({ pts: measured(pts) });

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
  const players = weekPlayers(days, WEEK, new Set(["a"]));
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
    expect(byKey("p").totals.pts).toBe(8);
    expect(byKey("a")).toMatchObject({ games: 2, countedGames: 2 });
    expect(byKey("a").totals.pts).toBe(30);
  });

  it("adds up to the team's counted totals", () => {
    const sum = players.reduce((total, player) => total + (player.totals.pts ?? 0), 0);
    expect(sum).toBe(countedTotals(days).pts);
  });

  it("labels partly and fully benched players, and nobody else", () => {
    expect(countedGamesLabel(byKey("p"))).toBe("1 of 2 G counted");
    expect(countedGamesLabel(byKey("b"))).toBe("Benched");
    expect(countedGamesLabel(byKey("a"))).toBeNull();
  });

  it("shows no value for a player whose games never counted, never a 0", () => {
    expect(weekValue(byKey("b"), "pts")).toBeNull();
    expect(weekValue(byKey("p"), "pts")).toBe(8);
  });

  it("orders contributors best first and the rest after, keeping roster order", () => {
    const ordered = orderWeekPlayers(players, "pts").map((player) => player.playerKey);
    expect(ordered).toEqual(["a", "n", "d", "p", "b"]);
  });
});
