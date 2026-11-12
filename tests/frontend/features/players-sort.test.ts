import { describe, expect, it } from "vitest";
import { measured, missingLine } from "../../../shared/domain";
import type {
  ListedPlayer,
  PlayerTotals,
} from "../../../client/src/features/daily-stats/players-model";
import { sortPlayers } from "../../../client/src/features/daily-stats/players-sort";

function listed(key: string, percent: number | null, change: number): ListedPlayer {
  return {
    player: { playerKey: key, name: key, nbaTeam: "DEN", positions: ["C"], injuryToday: null },
    ownership: { kind: "freeAgent" },
    rostered: { week: 5, percent, change },
  } as ListedPlayer;
}

function totals(key: string, pts: number, to: number): PlayerTotals {
  return {
    playerKey: key,
    gamesPlayed: 2,
    line: {
      fg: measured({ makes: 10, attempts: 20 }),
      ft: measured({ makes: 5, attempts: 5 }),
      tpm: measured(2),
      pts: measured(pts),
      reb: measured(8),
      ast: measured(4),
      stl: measured(2),
      blk: measured(2),
      to: measured(to),
    },
  };
}

const ROWS = [listed("a", 10, 1), listed("b", null, -2), listed("c", 55, 4), listed("d", 10, 0)];
const keys = (rows: readonly ListedPlayer[]) => rows.map((row) => row.player.playerKey).join("");

describe("sorting the Players page", () => {
  it("keeps Yahoo's rank order by default", () => {
    expect(keys(sortPlayers(ROWS, "rank", new Map()))).toBe("abcd");
  });

  it("sorts by rostered %, with Yahoo's under-1% last and ties in rank order", () => {
    expect(keys(sortPlayers(ROWS, "rostered", new Map()))).toBe("cadb");
  });

  it("sorts by this week's add trend", () => {
    expect(keys(sortPlayers(ROWS, "trend", new Map()))).toBe("cadb");
  });

  it("sorts a category by its per-game average, fewest turnovers first, unknown last", () => {
    const stats = new Map([
      ["a", totals("a", 20, 6)],
      ["b", totals("b", 40, 2)],
      ["c", { playerKey: "c", gamesPlayed: 0, line: missingLine("noGame") }],
      ["d", totals("d", 30, 4)],
    ]);
    expect(keys(sortPlayers(ROWS, "pts", stats))).toBe("bdac");
    expect(keys(sortPlayers(ROWS, "to", stats))).toBe("bdac");
  });
});
