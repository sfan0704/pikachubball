import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AccountControls } from "./AccountControls";
import { useAccountActions } from "./useAccountActions";

/** The header's Account button: opens disconnect Yahoo and delete account, each with its confirmation. */
export function AccountMenu() {
  const actions = useAccountActions();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label="Account"
          data-testid="button-account"
        >
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-10 text-lg font-semibold">Account</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Signing out keeps your data; these two remove it.
        </DialogDescription>
        <AccountControls actions={actions} />
      </DialogContent>
    </Dialog>
  );
}
