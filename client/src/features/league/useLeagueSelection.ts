import { useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import type { LeagueScope } from "@shared/api/league-scope";
import { useLeagues, useMe, useSavePreferences } from "@/api/hooks";
import { parseSelectionPath, resolveSelection, selectionPath, type Selection } from "./selection";

/**
 * The selected league, team and scope, held in the URL. A new visit is sent to
 * the URL of the saved (or default) selection; choosing something navigates,
 * so back works, and saves the league and team as the next visit's start.
 */
export function useLeagueSelection() {
  const [location, navigate] = useLocation();
  const me = useMe();
  const leagues = useLeagues();
  const savePreferences = useSavePreferences();

  const preferences = me.data?.preferences;
  const leagueList = leagues.data?.leagues;
  const selection = useMemo(
    () =>
      preferences && leagueList
        ? resolveSelection(parseSelectionPath(location), leagueList, preferences)
        : null,
    [location, preferences, leagueList]
  );

  // Make the URL say what is shown, replacing the entry so back doesn't bounce.
  const canonical = selection ? selectionPath(selection) : null;
  useEffect(() => {
    if (canonical !== null && location.split("?")[0] !== canonical) {
      navigate(canonical, { replace: true });
    }
  }, [canonical, location, navigate]);

  const select = useCallback(
    (change: Partial<Selection>) => {
      if (!selection || !leagueList || !preferences) {
        return;
      }
      const leagueChanged =
        change.leagueKey !== undefined && change.leagueKey !== selection.leagueKey;
      const league = leagueList.find((item) => item.leagueKey === change.leagueKey);
      const next: Selection = {
        leagueKey: change.leagueKey ?? selection.leagueKey,
        teamKey: leagueChanged
          ? (league?.teamKey ?? selection.teamKey)
          : (change.teamKey ?? selection.teamKey),
        scope: change.scope ?? selection.scope,
      };
      navigate(selectionPath(next));
      if (next.leagueKey !== selection.leagueKey || next.teamKey !== selection.teamKey) {
        savePreferences.mutate({
          ...preferences,
          selectedLeagueKey: next.leagueKey,
          selectedTeamKey: next.teamKey,
        });
      }
    },
    [selection, leagueList, preferences, navigate, savePreferences]
  );

  const setScope = useCallback((scope: LeagueScope) => select({ scope }), [select]);

  const status =
    me.isError || leagues.isError
      ? "error"
      : me.isPending || leagues.isPending
        ? "loading"
        : selection
          ? "ready"
          : "no-leagues";

  return {
    status,
    error: me.error ?? leagues.error,
    selection,
    leagues: leagueList ?? [],
    select,
    setScope,
  } as const;
}
