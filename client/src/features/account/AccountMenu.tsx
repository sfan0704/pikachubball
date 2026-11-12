import { LogOut, UserRound } from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { AccountControls } from "./AccountControls";
import { useAccountActions } from "./useAccountActions";

/**
 * The header's Account button. The mockup's header has room for one control,
 * so the theme, sign-out and the two removals (each with its confirmation) live here.
 */
export function AccountMenu() {
  const actions = useAccountActions();
  const { logout } = useAuth();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 h-11 w-11 shrink-0"
          aria-label="Account"
          data-testid="button-account"
        >
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-10 text-lg font-semibold">Account</DialogTitle>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">Theme</span>
          <ThemeToggle />
        </div>
        <Button
          variant="outline"
          className="justify-start"
          onClick={() => void logout()}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
        <DialogDescription className="text-sm text-muted-foreground">
          Signing out keeps your data; these two remove it.
        </DialogDescription>
        <AccountControls actions={actions} />
      </DialogContent>
    </Dialog>
  );
}
