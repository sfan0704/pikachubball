import { describe, expect, it } from "vitest";
import type { UserLeague } from "@shared/api/leagues";
import {
  parseSelectionPath,
  pickDefaultLeague,
  openScreen,
  resolveSelection,
  selectionPath,
  type Selection,
} from "../../../client/src/features/league/selection";
import {
  availableScreens,
  openingScreen,
  type Screen,
} from "../../../client/src/features/league/screens";

function league(overrides: Partial<UserLeague>): UserLeague {
  return {
    leagueKey: "466.l.1",
    teamKey: "466.l.1.t.3",
    name: "League",
    season: 2025,
    status: "active",
    syncedAt: "2026-10-08T01:00:00.000+00:00",
    ...overrides,
  };
}

const CURRENT = league({});
const OLD = league({
  leagueKey: "454.l.9",
  teamKey: "454.l.9.t.2",
  season: 2024,
  status: "finished",
});
const NO_PREFERENCE = { selectedLeagueKey: null, selectedTeamKey: null, display: {} };

const ALL: readonly Screen[] = ["matchup", "players", "league"];
const LEAGUE_ONLY: readonly Screen[] = ["league"];

function selection(overrides: Partial<Selection>): Selection {
  return {
    leagueKey: "466.l.1",
    teamKey: "466.l.1.t.3",
    screen: "league",
    scope: "current",
    day: "today",
    ...overrides,
  };
}

describe("selection paths", () => {
  it.each([
    [selection({ scope: 4 }), "/leagues/466.l.1/teams/466.l.1.t.3/4"],
    [selection({ scope: "season" }), "/leagues/466.l.1/teams/466.l.1.t.3/season"],
    [
      selection({ screen: "matchup", day: "yesterday" }),
      "/leagues/466.l.1/teams/466.l.1.t.3/matchup/yesterday",
    ],
    [
      selection({ screen: "matchup", day: "week" }),
      "/leagues/466.l.1/teams/466.l.1.t.3/matchup/week",
    ],
    [
      selection({ screen: "matchup", day: "week", scope: 4 }),
      "/leagues/466.l.1/teams/466.l.1.t.3/matchup/week/4",
    ],
    [selection({ screen: "players" }), "/leagues/466.l.1/teams/466.l.1.t.3/players"],
  ])("round-trips %o through its URL", (chosen, path) => {
    expect(selectionPath(chosen)).toBe(path);
    expect(parseSelectionPath(path)).toEqual(chosen);
  });

  it("keeps Matchup's day without a week number unless it shows a past week", () => {
    expect(selectionPath(selection({ screen: "matchup", day: "today", scope: 4 }))).toBe(
      "/leagues/466.l.1/teams/466.l.1.t.3/matchup/today"
    );
    expect(selectionPath(selection({ screen: "matchup", day: "week", scope: "season" }))).toBe(
      "/leagues/466.l.1/teams/466.l.1.t.3/matchup/week"
    );
  });

  it("ignores the query string", () => {
    expect(parseSelectionPath("/leagues/466.l.1/teams/466.l.1.t.3/season?x=1")?.scope).toBe(
      "season"
    );
    expect(parseSelectionPath("/leagues/466.l.1/teams/466.l.1.t.3/matchup/today/")?.day).toBe(
      "today"
    );
  });

  it.each([
    "/",
    "/auth",
    "/leagues/466.l.1",
    "/leagues/a/teams/b/week-3",
    "/leagues/a/teams/b/0",
    "/leagues/%E0%A4%A/teams/b/season",
    "/leagues/a/teams/b/matchup",
    "/leagues/a/teams/b/matchup/tomorrow",
    "/leagues/a/teams/b/matchup/today/extra",
    "/leagues/a/teams/b/matchup/today/4",
    "/leagues/a/teams/b/matchup/week/season",
    "/leagues/a/teams/b/matchup/week/0",
    "/leagues/a/teams/b/matchup/week/4/extra",
    "/leagues/a/teams/b/players/1",
    "/leagues/a/teams/b/season/1",
  ])("does not read %s as a selection", (path) => {
    expect(parseSelectionPath(path)).toBeNull();
  });
});

describe("screens", () => {
  it("shows only League, as before daily stats, when nothing is wired", () => {
    const screens = availableScreens({
      matchupAndLeague: false,
      players: false,
      projections: false,
    });

    expect(screens).toEqual(["league"]);
    expect(openingScreen(screens)).toBe("league");
  });

  it("opens on Matchup and lists the screens in order when daily stats are wired", () => {
    const screens = availableScreens({ matchupAndLeague: true, players: true, projections: false });

    expect(screens).toEqual(ALL);
    expect(openingScreen(screens)).toBe("matchup");
  });

  it("keeps Players behind its own switch", () => {
    expect(availableScreens({ matchupAndLeague: true, players: false, projections: true })).toEqual(
      ["matchup", "league"]
    );
  });
});

describe("default league", () => {
  it("prefers a current league over a finished one, and falls back to the first", () => {
    expect(pickDefaultLeague([OLD, CURRENT])).toBe(CURRENT);
    expect(pickDefaultLeague([OLD])).toBe(OLD);
    expect(pickDefaultLeague([])).toBeUndefined();
  });

  it("prefers a league in progress, then one that hasn't started, over a finished one", () => {
    const upcoming = league({ leagueKey: "478.l.5", teamKey: "478.l.5.t.1", status: "preseason" });

    expect(pickDefaultLeague([upcoming, CURRENT, OLD])).toBe(CURRENT);
    expect(pickDefaultLeague([OLD, upcoming])).toBe(upcoming);
  });
});

describe("resolving what to show", () => {
  it("uses a deep link to one of the user's leagues, with its scope and team", () => {
    const requested = selection({ leagueKey: "454.l.9", teamKey: "454.l.9.t.7", scope: 2 });

    expect(resolveSelection(requested, [CURRENT, OLD], NO_PREFERENCE, ALL)).toEqual(requested);
  });

  it("keeps a linked screen and day when that screen is wired", () => {
    const requested = selection({ screen: "matchup", day: "week" });

    expect(resolveSelection(requested, [CURRENT], NO_PREFERENCE, ALL)).toEqual(requested);
  });

  it("opens the opening screen instead of a linked screen that isn't wired", () => {
    const requested = selection({ screen: "players" });

    expect(resolveSelection(requested, [CURRENT], NO_PREFERENCE, LEAGUE_ONLY)).toEqual(
      selection({ screen: "league", scope: "season" })
    );
    expect(
      resolveSelection(requested, [CURRENT], NO_PREFERENCE, ["matchup", "league"])
    ).toMatchObject({ screen: "matchup", day: "today" });
  });

  it("uses the user's own team when the linked team is not in the league", () => {
    const requested = selection({ teamKey: "999.l.5.t.1", scope: "season" });

    expect(resolveSelection(requested, [CURRENT], NO_PREFERENCE, ALL)?.teamKey).toBe("466.l.1.t.3");
  });

  it("starts a first visit from the saved choice", () => {
    const preferences = {
      selectedLeagueKey: "454.l.9",
      selectedTeamKey: "454.l.9.t.5",
      display: {},
    };

    expect(resolveSelection(null, [CURRENT, OLD], preferences, LEAGUE_ONLY)).toEqual(
      selection({ leagueKey: "454.l.9", teamKey: "454.l.9.t.5", scope: "season" })
    );
    expect(resolveSelection(null, [CURRENT, OLD], preferences, ALL)).toMatchObject({
      screen: "matchup",
      scope: "current",
      day: "today",
    });
  });

  it("starts from the default league when nothing is saved or the saved league is gone", () => {
    const gone = { selectedLeagueKey: "1.l.1", selectedTeamKey: "1.l.1.t.1", display: {} };

    expect(resolveSelection(null, [OLD, CURRENT], NO_PREFERENCE, ALL)?.leagueKey).toBe("466.l.1");
    expect(resolveSelection(null, [OLD, CURRENT], gone, ALL)).toMatchObject({
      leagueKey: "466.l.1",
      teamKey: "466.l.1.t.3",
    });
  });

  it("ignores a link to a league the user does not have", () => {
    const requested = selection({ leagueKey: "1.l.1", teamKey: "1.l.1.t.1", scope: "season" });

    expect(resolveSelection(requested, [CURRENT], NO_PREFERENCE, ALL)?.leagueKey).toBe("466.l.1");
  });

  it("has nothing to show without leagues", () => {
    expect(resolveSelection(null, [], NO_PREFERENCE, ALL)).toBeNull();
  });
});

describe("opening a screen from the tab bar", () => {
  it("opens League on the season totals, whatever week was shown", () => {
    expect(openScreen(selection({ screen: "matchup", day: "week", scope: 4 }), "league")).toEqual(
      selection({ screen: "league", day: "week", scope: "season" })
    );
  });

  it("keeps the period and day when opening Matchup or Players", () => {
    const current = selection({ screen: "league", scope: 2 });

    expect(openScreen(current, "players")).toEqual({ ...current, screen: "players" });
    expect(openScreen(current, "matchup")).toEqual({ ...current, screen: "matchup" });
  });
});
