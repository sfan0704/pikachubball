import { useMemo } from "react";
import { useDeleteAccount, useDisconnectYahoo } from "@/api/hooks";
import type { AccountActions } from "./AccountControls";

/** The account controls' actions wired to the API; deleting the account also leaves the page. */
export function useAccountActions(): AccountActions {
  const disconnect = useDisconnectYahoo();
  const remove = useDeleteAccount();
  return useMemo(
    () => ({
      disconnectYahoo: () => disconnect.mutateAsync(),
      deleteAccount: async () => {
        const result = await remove.mutateAsync();
        window.location.assign("/auth");
        return result;
      },
    }),
    [disconnect, remove]
  );
}
