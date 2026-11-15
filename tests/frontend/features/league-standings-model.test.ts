import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { TeamTable } from "@shared/domain";
import { parseSeasonTable } from "../../../server/fantasy/league-tables";
import {
  categoryRankTable,
  categoryText,
  teamCells,
} from "../../../client/src/features/daily-stats/league-board-model";
import { categoryGrid } from "../../../client/src/features/daily-stats/league-categories-model";
import {
  luckText,
  officialRecords,
  ordinal,
  seasonAllPlayOf,
  standingsRows,
  weekAllPlay,
} from "../../../client/src/features/daily-stats/league-standings-model";
import { buildTeamTable } from "../../support/builders";
import { defined } from "../../support/defined";

const T = (n: number) => `466.l.1.t.${n}`;
const STRONG = {
  pts: 700,
  reb: 300,
  ast: 200,
  stl: 60,
  blk: 40,
  tpm: 90,
  to: 50,
  fgMakes: 260,
  ftMakes: 90,
};
const WEAK = {
  pts: 400,
  reb: 150,
  ast: 90,
  stl: 20,
  blk: 10,
  tpm: 30,
  to: 90,
  fgMakes: 200,
  ftMakes: 60,
};

/**
 * A week of four teams: 1 is the strongest, then 4, 3 and 2. Both strong teams
 * sweep their opponents, so 1 and 4 share first place and 2 and 3 share third.
 */
function week(): TeamTable {
  return buildTeamTable([STRONG, WEAK, {}, { ...STRONG, pts: 650, reb: 250 }], {
    pairings: [
      { teamKeys: [T(1), T(2)], winnerTeamKey: T(1), isTied: false },
      { teamKeys: [T(3), T(4)], winnerTeamKey: T(4), isTied: false },
    ],
  });
}

const rowsOf = (table: TeamTable, sort: "record" | "all-play" | "luck" = "record") =>
  standingsRows(table, T(3), weekAllPlay(table), sort);

describe("officialRecords", () => {
  it("plays out a week against the real opponents", () => {
    const records = officialRecords(week());
    expect(records[T(1)]).toEqual({ wins: 9, losses: 0, ties: 0 });
    expect(records[T(2)]).toEqual({ wins: 0, losses: 9, ties: 0 });
  });

  it("takes Yahoo's standings for the season and leaves out a team without them", () => {
    const base = buildTeamTable([{}, {}], { scope: { kind: "season" } });
    const season: TeamTable = {
      ...base,
      teams: [
        { ...defined(base.teams[0]), record: { wins: 30, losses: 20, ties: 4 } },
        defined(base.teams[1]),
      ],
    };
    expect(officialRecords(season)).toEqual({ [T(1)]: { wins: 30, losses: 20, ties: 4 } });
  });
});

describe("standingsRows", () => {
  it("ranks by the official record and shows all-play places and luck", () => {
    const rows = rowsOf(week());

    expect(rows.map((row) => [row.teamKey, row.rank, row.record, row.allPlayRank])).toEqual([
      [T(1), 1, "9–0–0", 1],
      [T(4), 1, "9–0–0", 2],
      [T(2), 3, "0–9–0", 4],
      [T(3), 3, "0–9–0", 3],
    ]);
    expect(rows.map((row) => luckText(defined(row.luck)))).toEqual(["+1.2", "+1.8", "0", "−3.0"]);
    expect(rows.find((row) => row.isMine)?.teamKey).toBe(T(3));
    expect(rows[2]).toMatchObject({ allPlayTone: "bottom" });
  });

  it("sorts by luck, luckiest first, and by all-play place", () => {
    const table = week();
    expect(rowsOf(table, "luck").map((row) => row.teamKey)).toEqual([T(4), T(1), T(2), T(3)]);
    expect(rowsOf(table, "all-play").map((row) => row.teamKey)).toEqual([T(1), T(4), T(3), T(2)]);
  });

  it("leaves all-play and luck unknown until all-play is there, and keeps the official order", () => {
    const rows = standingsRows(week(), T(3), null, "luck");
    expect(rows.map((row) => [row.allPlayRank, row.luck])).toEqual(Array(4).fill([null, null]));
    expect(rows.map((row) => row.rank)).toEqual([1, 1, 3, 3]);
  });

  it("puts a team without an official record last, unranked", () => {
    const table = { ...week(), pairings: week().pairings.slice(0, 1) };
    const rows = rowsOf(table);
    expect(rows.slice(2).map((row) => [row.rank, row.record, row.luck])).toEqual([
      [null, "—", null],
      [null, "—", null],
    ]);
  });

  it("adds every week's all-play up for the season", () => {
    const season = seasonAllPlayOf([week(), week()]);
    expect(season[T(1)]?.total).toEqual({ wins: 40, losses: 0, ties: 14 });
  });
});

describe("luckText and ordinal", () => {
  it("signs luck to one decimal and shows a plain zero", () => {
    expect([2.34, -1, 0.04, -0.04].map(luckText)).toEqual(["+2.3", "−1.0", "0", "0"]);
  });

  it("writes places as ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "103rd",
    ]);
  });
});

describe("category ranks", () => {
  it("ranks the lower-is-better category ascending and leaves unknown values unranked", () => {
    const ranks = categoryRankTable(buildTeamTable([{ to: 80, pts: null }, { to: 60 }]));
    expect(ranks[T(1)]?.["19"]).toBe(2);
    expect(ranks[T(2)]?.["19"]).toBe(1);
    expect(ranks[T(1)]?.["12"]).toBeNull();
    expect(ranks[T(2)]?.["12"]).toBe(1);
  });

  it("shows percentages to one decimal, other values as Yahoo gives them, unknown as a dash", () => {
    const [fg, , , pts] = buildTeamTable([{}]).settings.categories;
    expect(categoryText(defined(fg), 0.4789)).toBe("47.9%");
    expect(categoryText(defined(pts), 512)).toBe("512");
    expect(categoryText(defined(pts), null)).toBe("—");
  });

  it("gives a team's cells in the league's own categories", () => {
    const cells = teamCells(week(), T(1));
    expect(cells.map((cell) => cell.label)).toEqual([
      "FG%",
      "FT%",
      "3PTM",
      "PTS",
      "REB",
      "AST",
      "ST",
      "BLK",
      "TO",
    ]);
    expect(cells[3]).toMatchObject({ rank: 1, tone: "top", text: "700" });
  });
});

describe("categoryGrid", () => {
  it("keeps the standings order until a category is picked", () => {
    const grid = categoryGrid(week(), T(3), null);
    expect(grid.picked).toBeNull();
    expect(grid.rows.map((row) => [row.teamKey, row.total])).toEqual([
      [T(1), null],
      [T(4), null],
      [T(2), null],
      [T(3), null],
    ]);
  });

  it("orders by the picked category and shows its totals", () => {
    const grid = categoryGrid(week(), T(3), "19");
    expect(grid.picked?.displayName).toBe("TO");
    expect(grid.rows.map((row) => [row.teamKey, row.total])).toEqual([
      [T(1), "50"],
      [T(4), "50"],
      [T(3), "70"],
      [T(2), "90"],
    ]);
    expect(grid.rows[0]?.cells.filter((cell) => cell.picked)).toHaveLength(1);
  });

  it("ignores a picked category the league doesn't have", () => {
    expect(categoryGrid(week(), T(3), "999").picked).toBeNull();
  });

  it("follows a league with twelve teams and ten categories", () => {
    const response: unknown = JSON.parse(
      readFileSync("tests/backend/fixtures/yahoo/league-season-12-teams-10-categories.json", "utf8")
    );
    const table = parseSeasonTable(response, "2026-11-11T20:00:00.000Z");
    const grid = categoryGrid(table, defined(table.teams[0]).teamKey, null);
    expect(grid.categories).toHaveLength(10);
    expect(grid.rows).toHaveLength(12);
    expect(grid.rows.every((row) => row.cells.length === 10)).toBe(true);
    expect(standingsRows(table, defined(table.teams[0]).teamKey, null, "record")).toHaveLength(12);
  });
});
