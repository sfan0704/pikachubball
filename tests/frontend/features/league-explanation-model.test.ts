import { describe, expect, it } from "vitest";
import type { TeamTable } from "@shared/domain";
import {
  allPlayCells,
  explanationItems,
  luckLines,
  showsCategoryAllPlay,
  teamSummary,
} from "../../../client/src/features/daily-stats/league-explanation-model";
import { categoryLabel } from "../../../client/src/features/league/categories";
import { weekAllPlay } from "../../../client/src/features/daily-stats/league-standings-model";
import { buildLeagueSettings, buildTeamTable } from "../../support/builders";

const T = (n: number) => `466.l.1.t.${n}`;
const STRONG = {
  pts: 700,
  reb: 300,
  ast: 200,
  stl: 60,
  blk: 40,
  tpm: 90,
  to: 50,
  fgm: 260,
  ftm: 90,
};
const WEAK = {
  pts: 400,
  reb: 150,
  ast: 90,
  stl: 20,
  blk: 10,
  tpm: 30,
  to: 90,
  fgm: 200,
  ftm: 60,
};

/**
 * A week of four teams. Team 4 is the second strongest but meets team 1,
 * loses PTS and REB and ties the rest, so it has ties and negative luck.
 * Teams 2 and 3 differ only in PTS, so the weak pair is lucky.
 */
function week(): TeamTable {
  return buildTeamTable([STRONG, WEAK, { ...WEAK, pts: 450 }, { ...STRONG, pts: 650, reb: 250 }], {
    pairings: [
      { teamKeys: [T(1), T(4)], winnerTeamKey: T(1), isTied: false },
      { teamKeys: [T(2), T(3)], winnerTeamKey: T(3), isTied: false },
    ],
  });
}

describe("teamSummary", () => {
  it("shows the official place, the all-play place and luck with their records", () => {
    const table = week();
    expect(teamSummary(table, weekAllPlay(table), T(4))).toEqual([
      { label: "Standing", value: "4th", detail: "0–2–7" },
      { label: "All-play", value: "2nd", detail: "18–2–7" },
      { label: "Luck", value: "−3.7", detail: "category wins" },
    ]);
  });

  it("shows dashes for all-play and luck while all-play loads", () => {
    expect(teamSummary(week(), null, T(1))).toEqual([
      { label: "Standing", value: "1st", detail: "2–0–7" },
      { label: "All-play", value: "—", detail: "—" },
      { label: "Luck", value: "—", detail: "category wins" },
    ]);
  });
});

describe("luckLines", () => {
  it("works out negative luck with ties counted as half", () => {
    const table = week();
    expect(luckLines(table, weekAllPlay(table), T(4))).toEqual([
      { label: "Real wins", how: "0 won + 7 ties as half", value: "3.5" },
      { label: "Expected", how: "79.6% all-play × 9 categories", value: "7.2" },
      { label: "Luck", how: "the schedule hurt", value: "−3.7" },
    ]);
  });

  it("says the schedule helped when luck is positive", () => {
    const table = week();
    expect(luckLines(table, weekAllPlay(table), T(3))?.at(-1)).toEqual({
      label: "Luck",
      how: "the schedule helped",
      value: "+3.3",
    });
  });

  it("names a single tie in the singular", () => {
    const table = buildTeamTable([STRONG, { ...WEAK, blk: 40 }], {
      pairings: [{ teamKeys: [T(1), T(2)], winnerTeamKey: T(1), isTied: false }],
    });
    const lines = luckLines(table, weekAllPlay(table), T(2));
    expect(lines?.[0]).toEqual({ label: "Real wins", how: "0 won + 1 tie as half", value: "0.5" });
  });

  it("is left out without all-play or without an official record", () => {
    const table = week();
    expect(luckLines(table, null, T(1))).toBeNull();
    expect(luckLines({ ...table, pairings: [] }, weekAllPlay(table), T(1))).toBeNull();
  });
});

describe("showsCategoryAllPlay", () => {
  it("shows per-category all-play only for periods longer than one week", () => {
    expect(showsCategoryAllPlay(week())).toBe(false);
    expect(showsCategoryAllPlay({ ...week(), scope: { kind: "season" } })).toBe(true);
    const firstWeek = buildLeagueSettings({ startWeek: 1, currentWeek: 1 });
    expect(
      showsCategoryAllPlay({ ...week(), scope: { kind: "season" }, settings: firstWeek })
    ).toBe(false);
  });
});

describe("allPlayCells", () => {
  it("lists the league's own categories with each all-play record", () => {
    const table = week();
    const cells = allPlayCells(table, weekAllPlay(table), T(4));
    expect(cells.map((cell) => cell.label)).toEqual(
      table.settings.categories.map((category) => categoryLabel(category))
    );
    expect(cells.find((cell) => cell.label === "PTS")?.record).toBe("2–1–0");
    expect(allPlayCells(table, null, T(4)).every((cell) => cell.record === "—")).toBe(true);
  });

  it("follows a league with fewer categories", () => {
    const settings = buildLeagueSettings();
    const fewer = { ...settings, categories: settings.categories.slice(0, 5) };
    const table = buildTeamTable([STRONG, WEAK], { settings: fewer });
    expect(allPlayCells(table, weekAllPlay(table), T(1))).toHaveLength(5);
  });
});

describe("explanationItems", () => {
  it("explains each term with the viewer's own numbers", () => {
    const table = week();
    const items = explanationItems(table, weekAllPlay(table), T(4));
    expect(items.map((item) => item.term)).toEqual(["W–L–T", "All-play", "Luck", "Categories"]);
    expect(items[0]?.text).toContain("Each of the 9 categories");
    expect(items.map((item) => item.yours)).toEqual([
      "You: 0–2–7 from 9 categories. That puts you 4th.",
      "You: 18–2–7 from 27 categories (79.6%), 2nd in the league.",
      "You: 3.5 real − 7.2 expected (79.6% × 9) = −3.7.",
      "Your best: FG% (1st), FT% (1st).",
    ]);
  });

  it("uses the league's category count", () => {
    const settings = buildLeagueSettings();
    const table = buildTeamTable([STRONG, WEAK], {
      settings: { ...settings, categories: settings.categories.slice(0, 5) },
    });
    expect(explanationItems(table, null, T(1))[0]?.text).toContain("Each of the 5 categories is");
  });

  it("leaves out numbers that are not known yet", () => {
    const table = week();
    const loading = explanationItems(table, null, T(4));
    expect(loading.map((item) => item.yours === null)).toEqual([false, true, true, false]);
    const noTable = explanationItems(null, null, T(4));
    expect(noTable.every((item) => item.yours === null)).toBe(true);
    expect(noTable[0]?.text).toContain("Each of the league's categories");
  });

  it("has no best categories for a team with no values", () => {
    const base = buildTeamTable([{}, {}]);
    const table = {
      ...base,
      teams: base.teams.map((team) => ({ ...team, categoryValues: {} })),
    };
    expect(explanationItems(table, null, T(1))[3]?.yours).toBeNull();
  });
});
