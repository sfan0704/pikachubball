import { useRef } from "react";
import type { DailyPlayer } from "@shared/api/daily-stats-values";
import { Sheet, SheetContent, type SheetSide } from "@/components/ui/sheet";
import { PlayerDetails } from "./PlayerDetails";

interface PlayerDetailSheetProps {
  leagueKey: string;
  /** The player to show; null keeps the sheet closed. */
  player: DailyPlayer | null;
  /** The date the opening screen shows; the injury tag appears only when it is today. */
  viewDate: string;
  /** Up from the bottom on a phone; "right" is the drawer Matchup and Players use from the md breakpoint (FAN-152, FAN-153). */
  side?: SheetSide;
  onClose: () => void;
  onPickLeague: () => void;
}

/** The player details in a sheet that opens over the screen and returns focus to the row on close. */
export function PlayerDetailSheet({
  leagueKey,
  player,
  viewDate,
  side,
  onClose,
  onPickLeague,
}: PlayerDetailSheetProps) {
  // Radix returns focus only to a Dialog.Trigger; the rows open the sheet themselves.
  const opener = useRef<Element | null>(null);
  // Opened by the screen, so the sheet only ever asks to close.
  return (
    <Sheet open={player !== null} onOpenChange={onClose}>
      {player !== null && (
        <SheetContent
          data-testid="player-detail"
          side={side}
          onOpenAutoFocus={() => {
            opener.current = document.activeElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current instanceof HTMLElement) {
              opener.current.focus();
            }
          }}
        >
          <PlayerDetails
            leagueKey={leagueKey}
            player={player}
            viewDate={viewDate}
            onPickLeague={onPickLeague}
          />
        </SheetContent>
      )}
    </Sheet>
  );
}
