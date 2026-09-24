import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { League } from "@shared/schema";

const SELECTED_LEAGUE_STORAGE_KEY = "pikachubball:selected-league";

// Current leagues first, then upcoming, then past seasons.
const STATUS_PRIORITY: Record<NonNullable<League["status"]>, number> = {
  active: 0,
  preseason: 1,
  finished: 2,
};

function statusPriority(league: League): number {
  return STATUS_PRIORITY[league.status ?? "active"];
}

function readStoredLeagueKey(): string | null {
  try {
    return window.localStorage.getItem(SELECTED_LEAGUE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLeagueKey(leagueKey: string): void {
  try {
    window.localStorage.setItem(SELECTED_LEAGUE_STORAGE_KEY, leagueKey);
  } catch {
    // Storage unavailable (private mode); the selection lasts for this page only.
  }
}

/**
 * Picks the default league: status (active > preseason > finished), then the
 * highest season, then the highest game key, then the first in the list.
 */
export function pickDefaultLeague(leagues: League[]): League | undefined {
  return leagues.reduce<League | undefined>((best, current) => {
    if (!best) {
      return current;
    }
    const byStatus = statusPriority(current) - statusPriority(best);
    if (byStatus !== 0) {
      return byStatus < 0 ? current : best;
    }
    const bySeason = (current.season || 0) - (best.season || 0);
    if (bySeason !== 0) {
      return bySeason > 0 ? current : best;
    }
    const currentGameKey = current.gameKey ? parseInt(current.gameKey, 10) : 0;
    const bestGameKey = best.gameKey ? parseInt(best.gameKey, 10) : 0;
    return currentGameKey > bestGameKey ? current : best;
  }, undefined);
}

/**
 * Hook to fetch leagues and select one. An explicit choice is remembered
 * across reloads and kept when discovery results change; otherwise the most
 * current league is selected.
 */
export function useFirstLeague() {
  const [selectedLeagueKey, setSelectedLeagueKeyState] = useState<string>("");

  const { data: leaguesData, isLoading: isLoadingLeagues, error } = useQuery<{
    leagues: League[];
  }>({
    queryKey: ["/api/yahoo/leagues"],
    retry: false,
  });

  const leagues = leaguesData?.leagues || [];

  const setSelectedLeagueKey = useCallback((leagueKey: string) => {
    setSelectedLeagueKeyState(leagueKey);
    storeLeagueKey(leagueKey);
  }, []);

  useEffect(() => {
    if (leagues.length === 0) {
      return;
    }
    if (selectedLeagueKey && leagues.some((l) => l.leagueKey === selectedLeagueKey)) {
      return;
    }
    const stored = readStoredLeagueKey();
    const remembered = stored ? leagues.find((l) => l.leagueKey === stored) : undefined;
    const next = remembered ?? pickDefaultLeague(leagues);
    if (next) {
      setSelectedLeagueKeyState(next.leagueKey);
    }
  }, [leagues, selectedLeagueKey]);

  const selectedLeague = leagues.find((l) => l.leagueKey === selectedLeagueKey);

  return {
    leagues,
    selectedLeagueKey,
    setSelectedLeagueKey,
    selectedLeague,
    isLoadingLeagues,
    error,
  };
}
