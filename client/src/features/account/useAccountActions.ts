import { useMemo } from "react";
import { useDeleteAccount, useDisconnectYahoo } from "@/api/hooks";
import { useAuth } from "@/lib/auth";
import type { AccountActions } from "./AccountControls";

/** The account controls' actions wired to the API and the session; deleting the account also leaves the page. */
export function useAccountActions(): AccountActions {
  const { logout } = useAuth();
  const disconnect = useDisconnectYahoo();
  const remove = useDeleteAccount();
  return useMemo(
    () => ({
      signOut: logout,
      disconnectYahoo: () => disconnect.mutateAsync(),
      deleteAccount: async () => {
        const result = await remove.mutateAsync();
        window.location.assign("/auth");
        return result;
      },
    }),
    [logout, disconnect, remove]
  );
}
