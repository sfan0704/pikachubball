import { describe, expect, it } from "vitest";
import { missingLine } from "../../../shared/domain";
import type {
  ListedPlayer,
  PlayerTotals,
} from "../../../client/src/features/daily-stats/players-model";
import {
  playerSorts,
  sortedCategory,
  sortLabel,
  sortPlayers,
} from "../../../client/src/features/daily-stats/players-sort";
import {
  buildStatLine,
  CATEGORY,
  EIGHT_CATEGORIES,
  STANDARD_CATEGORIES,
  TEN_CATEGORIES,
} from "../../support/builders";

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
    line: buildStatLine({ fgm: 10, fga: 20, ftm: 5, fta: 5, pts, to }),
  };
}

const ROWS = [listed("a", 10, 1), listed("b", null, -2), listed("c", 55, 4), listed("d", 10, 0)];
const keys = (rows: readonly ListedPlayer[]) => rows.map((row) => row.player.playerKey).join("");

describe("sorting the Players page", () => {
  it("keeps Yahoo's rank order by default", () => {
    expect(keys(sortPlayers(ROWS, "rank", new Map(), STANDARD_CATEGORIES))).toBe("abcd");
  });

  it("sorts by rostered %, with Yahoo's under-1% last and ties in rank order", () => {
    expect(keys(sortPlayers(ROWS, "rostered", new Map(), STANDARD_CATEGORIES))).toBe("cadb");
  });

  it("sorts by this week's add trend", () => {
    expect(keys(sortPlayers(ROWS, "trend", new Map(), STANDARD_CATEGORIES))).toBe("cadb");
  });

  it("sorts a category by its per-game average, fewest turnovers first, unknown last", () => {
    const stats = new Map([
      ["a", totals("a", 20, 6)],
      ["b", totals("b", 40, 2)],
      ["c", { playerKey: "c", gamesPlayed: 0, line: missingLine("noGame") }],
      ["d", totals("d", 30, 4)],
    ]);
    expect(keys(sortPlayers(ROWS, "category-12", stats, STANDARD_CATEGORIES))).toBe("bdac");
    expect(keys(sortPlayers(ROWS, "category-19", stats, STANDARD_CATEGORIES))).toBe("bdac");
  });

  it("offers a sort for each of the league's own categories, and none it doesn't score", () => {
    expect(playerSorts(EIGHT_CATEGORIES)).toContain("category-20");
    expect(playerSorts(EIGHT_CATEGORIES)).not.toContain("category-19");
    expect(playerSorts(TEN_CATEGORIES)).toHaveLength(3 + 10);
    expect(sortedCategory("category-21", TEN_CATEGORIES)).toBe(CATEGORY.pf);
    expect(sortedCategory("category-21", STANDARD_CATEGORIES)).toBeNull();
    expect(sortedCategory("rank", TEN_CATEGORIES)).toBeNull();
  });

  it("keeps Yahoo's order when the chosen category isn't one the league scores", () => {
    expect(keys(sortPlayers(ROWS, "category-21", new Map(), STANDARD_CATEGORIES))).toBe("abcd");
  });

  it("names each sort", () => {
    expect(sortLabel("category-12", STANDARD_CATEGORIES)).toContain("PTS");
    expect(sortLabel("rank", STANDARD_CATEGORIES)).not.toBe("");
  });
});
