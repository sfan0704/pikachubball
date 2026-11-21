import { useMemo } from "react";
import { useDeleteAccount, useDisconnectYahoo } from "@/api/hooks";
import type { AccountActions } from "./AccountControls";
import { removalDestination } from "./removal";

/**
 * The account controls' actions wired to the API. Both removals end the session,
 * so both leave for the sign-in page with a full load that drops every cached screen.
 */
export function useAccountActions(): AccountActions {
  const disconnect = useDisconnectYahoo();
  const remove = useDeleteAccount();
  return useMemo(
    () => ({
      disconnectYahoo: async () => {
        const result = await disconnect.mutateAsync();
        window.location.assign(removalDestination("disconnect", result));
        return result;
      },
      deleteAccount: async () => {
        const result = await remove.mutateAsync();
        window.location.assign(removalDestination("delete", result));
        return result;
      },
    }),
    [disconnect, remove]
  );
}
