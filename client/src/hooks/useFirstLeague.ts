import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { League } from "@shared/schema";

/**
 * Hook to fetch leagues and auto-select the first one
 * Reduces duplication between RankingsPage and ChatPage
 */
export function useFirstLeague() {
  const [selectedLeagueKey, setSelectedLeagueKey] = useState<string>("");

  const { data: leaguesData, isLoading: isLoadingLeagues } = useQuery<{
    leagues: League[];
  }>({
    queryKey: ["/api/yahoo/leagues"],
    retry: false,
  });

  const leagues = leaguesData?.leagues || [];

  // Auto-select first league when leagues load
  useEffect(() => {
    if (leagues.length > 0 && !selectedLeagueKey) {
      setSelectedLeagueKey(leagues[0].leagueKey);
    }
  }, [leagues, selectedLeagueKey]);

  const selectedLeague = leagues.find((l) => l.leagueKey === selectedLeagueKey);

  return {
    leagues,
    selectedLeagueKey,
    setSelectedLeagueKey,
    selectedLeague,
    isLoadingLeagues,
  };
}
