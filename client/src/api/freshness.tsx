import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { GameLogsResponse } from "@shared/api/daily-stats";
import { liveSignal, type GameState, type LiveSignal } from "@shared/domain";
import { isGameLogsKey } from "./query-keys";
import { RateLimitBackoff } from "./rate-limit-backoff";

/** What every dataset query reads to set its timers. */
export interface Freshness {
  /** Whether any game shown on screen is live now; Live datasets poll only while it is. */
  readonly gamesLive: boolean;
  readonly backoff: RateLimitBackoff;
}

const FreshnessContext = createContext<Freshness | null>(null);

/** The longest delay setTimeout accepts; a later change is checked again then. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/** The game states in every game-log query that a mounted component is showing. */
function shownGames(queryClient: QueryClient): GameState[] {
  return queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => isGameLogsKey(query.queryKey) })
    .filter((query) => query.getObserversCount() > 0)
    .flatMap(
      (query) =>
        queryClient
          .getQueryData<GameLogsResponse>(query.queryKey)
          ?.players.flatMap((player) => player.games.map((game) => game.state)) ?? []
    );
}

/** Reads "games live now" from the cache, and reads it again when game logs change or a tip-off passes. */
function useGamesLiveNow(queryClient: QueryClient): boolean {
  const [gamesLive, setGamesLive] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const evaluate = () => {
      const signal: LiveSignal = liveSignal(shownGames(queryClient), Date.now());
      setGamesLive(signal.gamesLive);
      window.clearTimeout(timer);
      if (signal.changesAt !== null) {
        const delay = Math.min(Math.max(0, signal.changesAt - Date.now()), MAX_TIMER_MS);
        timer = window.setTimeout(evaluate, delay);
      }
    };
    evaluate();
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "added" && isGameLogsKey(event.query.queryKey)) {
        evaluate();
      }
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [queryClient]);
  return gamesLive;
}

/** Holds the live signal and rate-limit backoff for every dataset query below it. */
export function FreshnessProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [backoff] = useState(() => new RateLimitBackoff());
  const gamesLive = useGamesLiveNow(queryClient);
  const value = useMemo(() => ({ gamesLive, backoff }), [gamesLive, backoff]);
  return <FreshnessContext.Provider value={value}>{children}</FreshnessContext.Provider>;
}

/** The live signal and backoff; only the API hooks read them. */
export function useFreshness(): Freshness {
  const freshness = useContext(FreshnessContext);
  if (freshness === null) {
    throw new Error("useFreshness must be used inside a FreshnessProvider");
  }
  return freshness;
}
