import { describe, expect, it } from "vitest";
import type { DailyPlayer } from "../../../shared/api/daily-stats-values";
import type { TeamSchedule } from "../../../shared/domain";
import { measured, missing, missingLine } from "../../../shared/domain";
import {
  activeFilterCount,
  averageCells,
  gamesLeftText,
  isInactive,
  nbaTeamChoices,
  ownershipText,
  pageRangeText,
  passesFilters,
  playerCountText,
  poolStatus,
  rosteredChangeText,
  rosteredText,
  weekRangeText,
  weekStrip,
  type ListedPlayer,
  type PageFilters,
  type PlayerTotals,
} from "../../../client/src/features/daily-stats/players-model";

const PLAYER: DailyPlayer = {
  playerKey: "466.p.1",
  name: "Avery Ash",
  nbaTeam: "DEN",
  positions: ["PG"],
  injuryToday: null,
};

const ANY: PageFilters = { nbaTeam: null, schedule: "any", minGamesLeft: 0 };

/** Monday Nov 9 to Sunday Nov 15, 2026; the team plays Monday, Wednesday, Thursday and Saturday. */
const WEEK_DAYS = ["09", "10", "11", "12", "13", "14", "15"].map((day) => ({
  date: `2026-11-${day}`,
  plays: ["09", "11", "12", "14"].includes(day),
}));

const PLAYS_BOTH: TeamSchedule = {
  tonight: true,
  tomorrow: true,
  backToBack: true,
  gamesLeftThisWeek: 3,
  gamesThisWeek: 4,
  weekDays: WEEK_DAYS,
};
const PLAYS_TOMORROW: TeamSchedule = {
  tonight: false,
  tomorrow: true,
  backToBack: false,
  gamesLeftThisWeek: 1,
  gamesThisWeek: 4,
  weekDays: WEEK_DAYS,
};

describe("the Players list", () => {
  it("asks Yahoo for available players when the list is not owned, which includes waivers", () => {
    expect(poolStatus("notOwned")).toBe("available");
    expect(poolStatus("owned")).toBe("owned");
  });

  it("names the owner, the waiver clear day as Yahoo gives it, or nothing for a free agent", () => {
    expect(ownershipText({ kind: "team", teamKey: "466.l.1.t.2", teamName: "Team 2" })).toBe(
      "Team 2"
    );
    // Sunday, Nov 15, 2026.
    expect(ownershipText({ kind: "waivers", clearsOn: "2026-11-15" })).toBe("Clears Sun");
    expect(ownershipText({ kind: "freeAgent" })).toBeNull();
  });

  it('shows "<1%" when Yahoo leaves rostered % out, never 0', () => {
    expect(rosteredText({ week: 5, percent: null, change: 0 })).toBe("<1%");
    expect(rosteredText({ week: 5, percent: 0, change: 0 })).toBe("0%");
    expect(rosteredText({ week: 5, percent: 42, change: 3 })).toBe("42%");
  });

  it("shows the weekly change in points as an arrow", () => {
    expect(rosteredChangeText(3)).toBe("▲3");
    expect(rosteredChangeText(-2)).toBe("▼2");
    expect(rosteredChangeText(0)).toBe("±0");
  });

  it("counts players in words", () => {
    expect(playerCountText(1)).toBe("1 player");
    expect(playerCountText(25)).toBe("25 players");
  });

  it("badges the sheet filters that are on, but not the schedule bar", () => {
    expect(activeFilterCount(null, { ...ANY, schedule: "tonight" })).toBe(0);
    expect(activeFilterCount("C", { ...ANY, nbaTeam: "DEN", minGamesLeft: 2 })).toBe(3);
    expect(activeFilterCount(null, { ...ANY, minGamesLeft: 1 })).toBe(1);
  });

  it("labels Yahoo's NA status as inactive, and nothing else", () => {
    expect(isInactive({ ...PLAYER, injuryToday: { designation: "NA", reason: null } })).toBe(true);
    expect(isInactive({ ...PLAYER, injuryToday: { designation: "O", reason: "Knee" } })).toBe(
      false
    );
    expect(isInactive(PLAYER)).toBe(false);
  });

  it("says where the page sits in Yahoo's list", () => {
    expect(pageRangeText(0, 25)).toBe("Players 1–25");
    expect(pageRangeText(25, 19)).toBe("Players 26–44");
    expect(pageRangeText(0, 0)).toBe("No players");
  });

  it("offers every NBA team the schedule or the page names, once each, A to Z", () => {
    const page = [{ player: { ...PLAYER, nbaTeam: "PHX" } }] as ListedPlayer[];
    expect(nbaTeamChoices(["NYK", "BOS"], page)).toEqual(["BOS", "NYK", "PHX"]);
    expect(nbaTeamChoices(["PHX"], page)).toEqual(["PHX"]);
  });
});

describe("the week on a card", () => {
  it("marks game days, past days and today across the scoring week", () => {
    const strip = weekStrip(PLAYS_BOTH, "2026-11-11");
    expect(strip.map((day) => day.letter).join("")).toBe("MTWTFSS");
    expect(strip.filter((day) => day.plays).map((day) => day.name)).toEqual([
      "Mon",
      "Wed",
      "Thu",
      "Sat",
    ]);
    expect(strip.filter((day) => day.past).map((day) => day.date)).toEqual([
      "2026-11-09",
      "2026-11-10",
    ]);
    expect(strip.find((day) => day.today)?.date).toBe("2026-11-11");
  });

  it("gives games left against the week's games", () => {
    expect(gamesLeftText(PLAYS_BOTH)).toBe("3/4 left");
  });

  it("names the week's dates, with the month again when the week crosses one", () => {
    expect(weekRangeText("2026-11-09", "2026-11-15")).toBe("Nov 9–15");
    expect(weekRangeText("2026-11-30", "2026-12-06")).toBe("Nov 30–Dec 6");
  });
});

describe("the page filters", () => {
  it("keep everyone with no filters, even a team the schedule doesn't cover", () => {
    expect(passesFilters(PLAYER, undefined, ANY)).toBe(true);
  });

  it("keep only the chosen NBA team", () => {
    expect(passesFilters(PLAYER, PLAYS_BOTH, { ...ANY, nbaTeam: "DEN" })).toBe(true);
    expect(passesFilters(PLAYER, PLAYS_BOTH, { ...ANY, nbaTeam: "BOS" })).toBe(false);
  });

  it("follow tonight, tomorrow and back-to-back", () => {
    expect(passesFilters(PLAYER, PLAYS_BOTH, { ...ANY, schedule: "backToBack" })).toBe(true);
    expect(passesFilters(PLAYER, PLAYS_TOMORROW, { ...ANY, schedule: "tonight" })).toBe(false);
    expect(passesFilters(PLAYER, PLAYS_TOMORROW, { ...ANY, schedule: "tomorrow" })).toBe(true);
    expect(passesFilters(PLAYER, PLAYS_TOMORROW, { ...ANY, schedule: "backToBack" })).toBe(false);
  });

  it("need at least the chosen games left this week", () => {
    expect(passesFilters(PLAYER, PLAYS_BOTH, { ...ANY, minGamesLeft: 3 })).toBe(true);
    expect(passesFilters(PLAYER, PLAYS_TOMORROW, { ...ANY, minGamesLeft: 2 })).toBe(false);
  });

  it("drop a team the schedule doesn't cover from any schedule filter: unknown isn't idle or playing", () => {
    expect(passesFilters(PLAYER, undefined, { ...ANY, schedule: "tomorrow" })).toBe(false);
    expect(passesFilters(PLAYER, undefined, { ...ANY, minGamesLeft: 1 })).toBe(false);
  });
});

describe("the averages", () => {
  it("are per game, with FG% and FT% from total makes over attempts", () => {
    const cells = averageCells({
      playerKey: "466.p.1",
      gamesPlayed: 4,
      line: {
        fg: measured({ makes: 18, attempts: 40 }),
        ft: measured({ makes: 9, attempts: 10 }),
        tpm: measured(6),
        pts: measured(90),
        reb: measured(22),
        ast: measured(10),
        stl: measured(4),
        blk: missing("unavailable"),
        to: measured(7),
      },
    });
    expect(cells.map((cell) => [cell.label, cell.text])).toEqual([
      ["FG%", ".450"],
      ["FT%", ".900"],
      ["3PM", "1.5"],
      ["PTS", "22.5"],
      ["REB", "5.5"],
      ["AST", "2.5"],
      ["STL", "1.0"],
      ["BLK", "—"],
      ["TO", "1.8"],
    ]);
  });

  it("are unknown, never 0, before the stats arrive or with no games played", () => {
    expect(averageCells(null).every((cell) => cell.text === "—")).toBe(true);
    const none = averageCells({
      playerKey: "466.p.1",
      gamesPlayed: 0,
      line: missingLine("noGame"),
    });
    expect(none.every((cell) => cell.text === "—")).toBe(true);
  });

  it("colour a period against the season only when the gap is clear, with fewer turnovers better", () => {
    const totals = (pts: number, to: number, fgMakes: number): PlayerTotals => ({
      playerKey: "466.p.1",
      gamesPlayed: 1,
      line: {
        fg: measured({ makes: fgMakes, attempts: 100 }),
        ft: measured({ makes: 8, attempts: 10 }),
        tpm: measured(2),
        pts: measured(pts),
        reb: measured(5),
        ast: measured(5),
        stl: measured(1),
        blk: measured(1),
        to: measured(to),
      },
    });
    const season = totals(20, 3, 45);
    const tones = (cells: ReturnType<typeof averageCells>) =>
      Object.fromEntries(cells.map((cell) => [cell.key, cell.tone]));
    // PTS +4 clears 10% of 20; TO −1 is better; FG% +2 points is too small.
    expect(tones(averageCells(totals(24, 2, 47), season))).toMatchObject({
      pts: "better",
      to: "better",
      fgPct: null,
      reb: null,
    });
    // PTS −1.5 is under 10% of 20; FG% −5 points is clear.
    expect(tones(averageCells(totals(18.5, 4, 40), season))).toMatchObject({
      pts: null,
      to: "worse",
      fgPct: "worse",
    });
    expect(averageCells(totals(30, 3, 45)).every((cell) => cell.tone === null)).toBe(true);
  });
});
