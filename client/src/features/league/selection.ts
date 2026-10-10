import { leagueScopeSchema, type LeagueScope } from "@shared/api/league-scope";
import type { Preferences } from "@shared/api/account";
import type { UserLeague } from "@shared/api/leagues";

/** What the user is looking at: a league, a team in it, and a scope. */
export interface Selection {
  readonly leagueKey: string;
  readonly teamKey: string;
  readonly scope: LeagueScope;
}

/** What a URL says, before it is checked against the user's leagues. */
export interface RequestedSelection {
  readonly leagueKey: string;
  readonly teamKey: string;
  readonly scope: LeagueScope;
}

const PATH = /^\/leagues\/([^/]+)\/teams\/([^/]+)\/([^/]+)\/?$/;

/** The URL that holds a selection, so refresh, back and shared links all work. */
export function selectionPath({ leagueKey, teamKey, scope }: Selection): string {
  return `/leagues/${encodeURIComponent(leagueKey)}/teams/${encodeURIComponent(teamKey)}/${scope}`;
}

/** The selection a path asks for, or null when it isn't a league path. */
export function parseSelectionPath(path: string): RequestedSelection | null {
  const match = PATH.exec(path.split("?")[0]);
  if (!match) {
    return null;
  }
  try {
    const scope = leagueScopeSchema.safeParse(decodeURIComponent(match[3]));
    return scope.success
      ? {
          leagueKey: decodeURIComponent(match[1]),
          teamKey: decodeURIComponent(match[2]),
          scope: scope.data,
        }
      : null;
  } catch {
    return null;
  }
}

/** Current leagues first (the list arrives newest season first); a finished league only when it's all there is. */
export function pickDefaultLeague(leagues: readonly UserLeague[]): UserLeague | undefined {
  return leagues.find((league) => !league.isFinished) ?? leagues[0];
}

function teamIn(league: UserLeague, teamKey: string | null): string {
  return teamKey !== null && teamKey.startsWith(`${league.leagueKey}.t.`)
    ? teamKey
    : league.teamKey;
}

/**
 * The selection to show. The URL wins when it names one of the user's leagues;
 * otherwise a new visit starts from the saved choice, then from the default
 * league. The team is the URL's when it belongs to the league, else the user's.
 */
export function resolveSelection(
  requested: RequestedSelection | null,
  leagues: readonly UserLeague[],
  preferences: Preferences
): Selection | null {
  const fromUrl = leagues.find((league) => league.leagueKey === requested?.leagueKey);
  if (fromUrl && requested) {
    return {
      leagueKey: fromUrl.leagueKey,
      teamKey: teamIn(fromUrl, requested.teamKey),
      scope: requested.scope,
    };
  }
  const saved = leagues.find((league) => league.leagueKey === preferences.selectedLeagueKey);
  const league = saved ?? pickDefaultLeague(leagues);
  if (!league) {
    return null;
  }
  const preferredTeam = saved ? preferences.selectedTeamKey : null;
  return { leagueKey: league.leagueKey, teamKey: teamIn(league, preferredTeam), scope: "current" };
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
    leagueKey,
    teamKey: leagueChanged
      ? (league?.teamKey ?? current.teamKey)
      : (change.teamKey ?? current.teamKey),
    scope: change.scope ?? current.scope,
  };
}
