import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { InjuryTag } from "./InjuryTag";

interface PlayerButtonProps {
  player: DailyPlayer;
  /** Whether the row shows today's status; never on a past date. */
  showInjury: boolean;
  onOpen: (player: DailyPlayer) => void;
}

/**
 * A player's name and positions, opening the player detail, with the injury
 * tag beside it. The tag is a separate link, not inside the button, so each
 * has its own target.
 */
export function PlayerButton({ player, showInjury, onOpen }: PlayerButtonProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <button
        type="button"
        onClick={() => onOpen(player)}
        className="min-h-[44px] min-w-0 rounded-md text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block text-sm font-medium">{player.name}</span>
        <span className="block text-xs text-muted-foreground">
          <span data-testid="player-positions">{player.positions.join(", ")}</span> ·{" "}
          {player.nbaTeam}
        </span>
      </button>
      {showInjury && <InjuryTag player={player} />}
    </div>
  );
}
