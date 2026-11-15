import type { TeamTable } from "@shared/domain";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TeamDetails } from "./TeamDetails";

interface TeamPopoverProps {
  table: TeamTable;
  leagueKey: string;
  teamKey: string;
  periodLabel: string;
  onClose: () => void;
  /** Puts focus back where the popover was opened from. */
  returnFocus: () => void;
  onPickLeague: () => void;
}

/** The team details in a dialog over League: a sheet from the bottom on a phone. */
export function TeamPopover({ onClose, returnFocus, ...details }: TeamPopoverProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="team-popover"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus();
        }}
      >
        <TeamDetails {...details} />
      </DialogContent>
    </Dialog>
  );
}
