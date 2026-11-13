/**
 * @vitest-environment happy-dom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { Router } from "wouter";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../client/src/api/query-keys";
import { connectErrorMessage } from "../../../client/src/features/account/useConnectResult";

/** Renders the connect-result hook against a fresh toast module and the given URL. */
async function renderConnectResult(url: string) {
  vi.resetModules();
  const { useConnectResult } =
    await import("../../../client/src/features/account/useConnectResult");
  const { useToast } = await import("../../../client/src/hooks/use-toast");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  window.history.pushState({}, "", url);

  function Probe(): ReactElement {
    // Subscribe first: the connect-result effect dispatches its toast
    // synchronously, and the listener must exist before that dispatch.
    const { toasts } = useToast();
    useConnectResult();
    return (
      <div data-testid="toasts">
        {toasts.map((toast) => `${toast.title}|${toast.description}`).join(";")}
      </div>
    );
  }

  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>{children}</Router>
      </QueryClientProvider>
    );
  }

  render(<Probe />, { wrapper: Wrapper });
  return { invalidateSpy };
}

describe("connectErrorMessage", () => {
  it.each([
    ["error=yahoo_oauth_error&details=denied", "denied"],
    ["error=yahoo_oauth_error&description=denied", "denied"],
    ["error=yahoo_oauth_error", "Yahoo OAuth authorization failed"],
    ["error=token_exchange_failed&details=bad+code", "bad code"],
    ["error=token_exchange_failed", "Failed to exchange authorization code."],
    ["error=missing_code", "Missing authorization code. Please try connecting again."],
    ["error=invalid_state", "Invalid OAuth state. Please try connecting again."],
    ["error=not_authenticated", "You must be logged in to connect Yahoo."],
    ["error=mystery", "Yahoo OAuth error occurred"],
    ["", "Yahoo OAuth error occurred"],
  ])("maps %s to %s", (query, expected) => {
    expect(connectErrorMessage(new URLSearchParams(query))).toBe(expected);
  });
});

describe("useConnectResult", () => {
  it("shows the error toast and strips the error parameters, keeping the rest", async () => {
    await renderConnectResult("/?error=missing_code&details=x&foo=bar");

    expect(screen.getByTestId("toasts")).toHaveTextContent(
      "Yahoo Connection Error|Missing authorization code. Please try connecting again."
    );
    expect(window.location.search).toBe("?foo=bar");
  });

  it("reports the Yahoo detail when the OAuth flow failed", async () => {
    await renderConnectResult("/?error=yahoo_oauth_error&details=access+denied");

    expect(screen.getByTestId("toasts")).toHaveTextContent("Yahoo Connection Error|access denied");
    expect(window.location.search).toBe("");
  });

  it("shows the success toast, refreshes the account, and strips the flag", async () => {
    const { invalidateSpy } = await renderConnectResult("/?yahoo_connected=true");

    expect(screen.getByTestId("toasts")).toHaveTextContent(
      "Successfully Connected|Your Yahoo Fantasy account has been connected!"
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.me });
    expect(window.location.search).toBe("");
  });

  it("does nothing when the URL carries no connect result", async () => {
    await renderConnectResult("/?foo=bar");

    expect(screen.getByTestId("toasts")).toBeEmptyDOMElement();
    expect(window.location.search).toBe("?foo=bar");
  });
});
