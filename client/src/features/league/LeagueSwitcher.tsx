import { ChevronDown } from "lucide-react";
import type { LeagueStatus, UserLeague } from "@shared/api/leagues";

/** What follows a league's name in the switcher; a league in progress needs no note. */
const STATUS_SUFFIX: Record<LeagueStatus, string> = {
  preseason: " – preseason",
  active: "",
  finished: " – finished",
};

interface LeagueSwitcherProps {
  league: UserLeague;
  leagues: readonly UserLeague[];
  onPick: (leagueKey: string) => void;
}

/**
 * The header's title: the league's name, which is also the league switcher
 * when there is more than one. A native select sits over the name so any
 * keyboard, screen reader or phone picker can use it.
 */
export function LeagueSwitcher({ league, leagues, onPick }: LeagueSwitcherProps) {
  const canSwitch = leagues.length > 1;
  return (
    <h1 className="relative flex min-w-0 items-center gap-1 text-base font-bold">
      <span className="truncate">{league.name}</span>
      {canSwitch && (
        <>
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
          <select
            aria-label="League"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={league.leagueKey}
            onChange={(event) => onPick(event.target.value)}
            data-testid="league-switcher"
          >
            {leagues.map((item) => (
              <option key={item.leagueKey} value={item.leagueKey}>
                {item.name}
                {item.season ? ` (${item.season})` : ""}
                {STATUS_SUFFIX[item.status]}
              </option>
            ))}
          </select>
        </>
      )}
    </h1>
  );
}
