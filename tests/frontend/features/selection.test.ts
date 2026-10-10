import { describe, expect, it } from "vitest";
import type { UserLeague } from "@shared/api/leagues";
import {
  parseSelectionPath,
  pickDefaultLeague,
  resolveSelection,
  selectionPath,
} from "../../../client/src/features/league/selection";

function league(overrides: Partial<UserLeague>): UserLeague {
  return {
    leagueKey: "466.l.1",
    teamKey: "466.l.1.t.3",
    name: "League",
    season: 2025,
    isFinished: false,
    syncedAt: "2026-10-08T01:00:00.000+00:00",
    ...overrides,
  };
}

const CURRENT = league({});
const OLD = league({
  leagueKey: "454.l.9",
  teamKey: "454.l.9.t.2",
  season: 2024,
  isFinished: true,
});
const NO_PREFERENCE = { selectedLeagueKey: null, selectedTeamKey: null, display: {} };

describe("selection paths", () => {
  it("round-trips a selection through its URL", () => {
    const path = selectionPath({ leagueKey: "466.l.1", teamKey: "466.l.1.t.3", scope: 4 });

    expect(path).toBe("/leagues/466.l.1/teams/466.l.1.t.3/4");
    expect(parseSelectionPath(path)).toEqual({
      leagueKey: "466.l.1",
      teamKey: "466.l.1.t.3",
      scope: 4,
    });
    expect(parseSelectionPath("/leagues/466.l.1/teams/466.l.1.t.3/season?x=1")?.scope).toBe(
      "season"
    );
  });

  it.each([
    "/",
    "/auth",
    "/leagues/466.l.1",
    "/leagues/a/teams/b/week-3",
    "/leagues/a/teams/b/0",
    "/leagues/%E0%A4%A/teams/b/season",
  ])("does not read %s as a selection", (path) => {
    expect(parseSelectionPath(path)).toBeNull();
  });
});

describe("default league", () => {
  it("prefers a current league over a finished one, and falls back to the first", () => {
    expect(pickDefaultLeague([OLD, CURRENT])).toBe(CURRENT);
    expect(pickDefaultLeague([OLD])).toBe(OLD);
    expect(pickDefaultLeague([])).toBeUndefined();
  });
});

describe("resolving what to show", () => {
  it("uses a deep link to one of the user's leagues, with its scope and team", () => {
    const requested = { leagueKey: "454.l.9", teamKey: "454.l.9.t.7", scope: 2 } as const;

    expect(resolveSelection(requested, [CURRENT, OLD], NO_PREFERENCE)).toEqual({
      leagueKey: "454.l.9",
      teamKey: "454.l.9.t.7",
      scope: 2,
    });
  });

  it("uses the user's own team when the linked team is not in the league", () => {
    const requested = { leagueKey: "466.l.1", teamKey: "999.l.5.t.1", scope: "season" } as const;

    expect(resolveSelection(requested, [CURRENT], NO_PREFERENCE)?.teamKey).toBe("466.l.1.t.3");
  });

  it("starts a first visit from the saved choice", () => {
    const preferences = {
      selectedLeagueKey: "454.l.9",
      selectedTeamKey: "454.l.9.t.5",
      display: {},
    };

    expect(resolveSelection(null, [CURRENT, OLD], preferences)).toEqual({
      leagueKey: "454.l.9",
      teamKey: "454.l.9.t.5",
      scope: "current",
    });
  });

  it("starts from the default league when nothing is saved or the saved league is gone", () => {
    const gone = { selectedLeagueKey: "1.l.1", selectedTeamKey: "1.l.1.t.1", display: {} };

    expect(resolveSelection(null, [OLD, CURRENT], NO_PREFERENCE)?.leagueKey).toBe("466.l.1");
    expect(resolveSelection(null, [OLD, CURRENT], gone)).toMatchObject({
      leagueKey: "466.l.1",
      teamKey: "466.l.1.t.3",
    });
  });

  it("ignores a link to a league the user does not have", () => {
    const requested = { leagueKey: "1.l.1", teamKey: "1.l.1.t.1", scope: "season" } as const;

    expect(resolveSelection(requested, [CURRENT], NO_PREFERENCE)?.leagueKey).toBe("466.l.1");
  });

  it("has nothing to show without leagues", () => {
    expect(resolveSelection(null, [], NO_PREFERENCE)).toBeNull();
  });
});
