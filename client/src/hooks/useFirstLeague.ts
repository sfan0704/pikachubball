import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { League } from "@shared/schema";

/**
 * Hook to fetch leagues and auto-select the first one
 * Used by RankingsPage and can be shared with other components
 */
export function useFirstLeague() {
  const [selectedLeagueKey, setSelectedLeagueKey] = useState<string>("");

  const { data: leaguesData, isLoading: isLoadingLeagues, error } = useQuery<{
    leagues: League[];
  }>({
    queryKey: ["/api/yahoo/leagues"],
    retry: false,
  });

  const leagues = leaguesData?.leagues || [];

  // Auto-select most current and active NBA league when leagues load
  useEffect(() => {
    if (leagues.length > 0 && !selectedLeagueKey) {
      // Find the most current and active NBA league
      // Priority: 1) Highest season, 2) Highest game key (more recent), 3) First in list
      const mostCurrentLeague = leagues.reduce((best, current) => {
        // Compare by season (higher is better)
        const currentSeason = current.season || 0;
        const bestSeason = best.season || 0;
        
        if (currentSeason > bestSeason) {
          return current;
        } else if (currentSeason < bestSeason) {
          return best;
        }
        
        // If seasons are equal, compare by game key (higher number = more recent)
        const currentGameKey = current.gameKey ? parseInt(current.gameKey, 10) : 0;
        const bestGameKey = best.gameKey ? parseInt(best.gameKey, 10) : 0;
        
        if (currentGameKey > bestGameKey) {
          return current;
        }
        
        return best;
      });
      
      setSelectedLeagueKey(mostCurrentLeague.leagueKey);
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
