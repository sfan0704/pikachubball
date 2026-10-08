/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../../client/src/lib/auth";
import { jsonResponse } from "../../support/fetch";

const ME = {
  user: { id: "u1", displayName: "Tester", email: "t@example.test" },
  yahoo: { connected: true },
  preferences: { selectedLeagueKey: null, selectedTeamKey: null, display: {} },
};

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("useAuth", () => {
  it("throws outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider"
    );

    spy.mockRestore();
  });

  it("is loading until /api/me answers, then has the signed-in user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(ME))
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual(ME.user);
  });

  it("has no user when the session has ended", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ code: "UNAUTHORIZED", message: "x", requestId: "r" }, 401))
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });
});

describe("logout", () => {
  it("signs out through the API and then starts afresh at the sign-in page", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      jsonResponse(url === "/api/auth/logout" ? { success: true } : ME)
    );
    vi.stubGlobal("fetch", fetchMock);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST" })
    );
    expect(assign).toHaveBeenCalledWith("/auth");
  });
});
