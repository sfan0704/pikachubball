import { leagueScopeSchema, type LeagueScope } from "@shared/api/league-scope";
import type { Preferences } from "@shared/api/account";
import type { UserLeague } from "@shared/api/leagues";
import { MATCHUP_DAYS, openingScreen, type MatchupDay, type Screen } from "./screens";

/** What the user is looking at: a league, a team in it, a screen, and that screen's scope or day. */
export interface Selection {
  readonly leagueKey: string;
  readonly teamKey: string;
  readonly screen: Screen;
  /** The League screen's period, or the week Matchup Week shows; other screens use the current week. */
  readonly scope: LeagueScope;
  /** The Matchup day; other screens keep today. */
  readonly day: MatchupDay;
}

/** What a URL says, before it is checked against the user's leagues and wired screens. */
export type RequestedSelection = Selection;

const PATH = /^\/leagues\/([^/]+)\/teams\/([^/]+)\/(.+?)\/?$/;

/**
 * The URL that holds a selection, so refresh, back and shared links all work:
 * `…/matchup/<day>` (`…/matchup/week/<n>` for a past week), `…/players`, or
 * `…/<scope>` for League, as before daily stats.
 */
export function selectionPath({ leagueKey, teamKey, screen, scope, day }: Selection): string {
  const base = `/leagues/${encodeURIComponent(leagueKey)}/teams/${encodeURIComponent(teamKey)}`;
  if (screen === "matchup") {
    const week = day === "week" && typeof scope === "number" ? `/${scope}` : "";
    return `${base}/matchup/${day}${week}`;
  }
  return screen === "players" ? `${base}/players` : `${base}/${scope}`;
}

type ScreenPart = Pick<Selection, "screen" | "scope" | "day">;

/** `<day>`, or `week/<n>` for one scoring week. */
function parseMatchup(day: string | undefined, week: string | undefined): ScreenPart | null {
  const found = MATCHUP_DAYS.find((candidate) => candidate === day);
  if (!found || (week !== undefined && found !== "week")) {
    return null;
  }
  const scope = week === undefined ? "current" : leagueScopeSchema.safeParse(week).data;
  return typeof scope === "number" || scope === "current"
    ? { screen: "matchup", scope, day: found }
    : null;
}

/** The screen, scope and day that the rest of the path names, or null. */
function parseScreen(rest: string): ScreenPart | null {
  const [first, second, third, ...extra] = rest.split("/");
  if (first === "matchup") {
    return extra.length > 0 ? null : parseMatchup(second, third);
  }
  if (second !== undefined || third !== undefined) {
    return null;
  }
  if (first === "players") {
    return { screen: "players", scope: "current", day: "today" };
  }
  const scope = leagueScopeSchema.safeParse(first);
  return scope.success ? { screen: "league", scope: scope.data, day: "today" } : null;
}

/** The selection a path asks for, or null when it isn't a league path. */
export function parseSelectionPath(path: string): RequestedSelection | null {
  const match = PATH.exec(path.split("?")[0]);
  if (!match) {
    return null;
  }
  try {
    const screen = parseScreen(decodeURIComponent(match[3]));
    return screen
      ? {
          leagueKey: decodeURIComponent(match[1]),
          teamKey: decodeURIComponent(match[2]),
          ...screen,
        }
      : null;
  } catch {
    return null;
  }
}

/**
 * A league in progress first, then one that hasn't started, then the newest
 * finished one (the list arrives newest season first).
 */
export function pickDefaultLeague(leagues: readonly UserLeague[]): UserLeague | undefined {
  return (
    leagues.find((league) => league.status === "active") ??
    leagues.find((league) => league.status === "preseason") ??
    leagues[0]
  );
}

function teamIn(league: UserLeague, teamKey: string | null): string {
  return teamKey !== null && teamKey.startsWith(`${league.leagueKey}.t.`)
    ? teamKey
    : league.teamKey;
}

/** Where a visit to a league starts: the opening screen, the current week, today. */
function opening(screens: readonly Screen[]): ScreenPart {
  return { screen: openingScreen(screens), scope: "current", day: "today" };
}

/**
 * The selection to show. The URL wins when it names one of the user's leagues
 * and a wired screen; otherwise a new visit starts from the saved choice, then
 * from the default league, on the opening screen. The team is the URL's when it
 * belongs to the league, else the user's.
 */
export function resolveSelection(
  requested: RequestedSelection | null,
  leagues: readonly UserLeague[],
  preferences: Preferences,
  screens: readonly Screen[]
): Selection | null {
  const fromUrl = leagues.find((league) => league.leagueKey === requested?.leagueKey);
  if (fromUrl && requested) {
    const { screen, scope, day } = requested;
    return {
      leagueKey: fromUrl.leagueKey,
      teamKey: teamIn(fromUrl, requested.teamKey),
      ...(screens.includes(screen) ? { screen, scope, day } : opening(screens)),
    };
  }
  const saved = leagues.find((league) => league.leagueKey === preferences.selectedLeagueKey);
  const league = saved ?? pickDefaultLeague(leagues);
  if (!league) {
    return null;
  }
  const preferredTeam = saved ? preferences.selectedTeamKey : null;
  return {
    leagueKey: league.leagueKey,
    teamKey: teamIn(league, preferredTeam),
    ...opening(screens),
  };
}

/**
 * The selection after the user changes part of it. Choosing another league
 * moves to the user's own team there; otherwise the team stays unless changed.
 */
export function applyChange(
  current: Selection,
  change: Partial<Selection>,
  leagues: readonly UserLeague[]
): Selection {
  const leagueKey = change.leagueKey ?? current.leagueKey;
  const league = leagues.find((item) => item.leagueKey === leagueKey);
  const leagueChanged = leagueKey !== current.leagueKey;
  return {
    ...current,
    ...change,
    leagueKey,
    teamKey: leagueChanged
      ? (league?.teamKey ?? current.teamKey)
      : (change.teamKey ?? current.teamKey),
  };
}
