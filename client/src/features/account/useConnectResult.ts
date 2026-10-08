import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/query-keys";
import { useToast } from "@/hooks/use-toast";

const MESSAGES: Record<string, string> = {
  token_exchange_failed: "Failed to exchange authorization code.",
  missing_code: "Missing authorization code. Please try connecting again.",
  invalid_state: "Invalid OAuth state. Please try connecting again.",
  not_authenticated: "You must be logged in to connect Yahoo.",
};

/** What the Yahoo connection flow reported through the URL, as text for the user. */
export function connectErrorMessage(params: URLSearchParams): string {
  const error = params.get("error") ?? "";
  const detail = params.get("details") ?? params.get("description");
  if (error === "yahoo_oauth_error") {
    return detail || "Yahoo OAuth authorization failed";
  }
  return (
    (error === "token_exchange_failed" && detail) || MESSAGES[error] || "Yahoo OAuth error occurred"
  );
}

/**
 * Reports the result of the Yahoo connection flow, which comes back as
 * `?error=` or `?yahoo_connected=true`, then removes those parameters.
 */
export function useConnectResult(): void {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const failed = params.has("error");
    if (!failed && params.get("yahoo_connected") !== "true") {
      return;
    }
    if (failed) {
      toast({
        title: "Yahoo Connection Error",
        description: connectErrorMessage(params),
        variant: "destructive",
        duration: 10000,
      });
    } else {
      toast({
        title: "Successfully Connected",
        description: "Your Yahoo Fantasy account has been connected!",
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    }
    for (const name of ["error", "details", "description", "yahoo_connected"]) {
      params.delete(name);
    }
    const rest = params.toString();
    navigate(`${location.split("?")[0]}${rest ? `?${rest}` : ""}`, { replace: true });
  }, [location, navigate, toast, queryClient]);
}
