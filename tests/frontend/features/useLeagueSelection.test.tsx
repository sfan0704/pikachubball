/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLeagueSelection } from "../../../client/src/features/league/useLeagueSelection";
import { jsonResponse } from "../../support/fetch";

const LEAGUES = {
  leagues: [
    {
      leagueKey: "466.l.1",
      teamKey: "466.l.1.t.3",
      name: "Current",
      season: 2025,
      status: "active",
      syncedAt: "2026-10-08T01:00:00.000+00:00",
    },
    {
      leagueKey: "454.l.9",
      teamKey: "454.l.9.t.2",
      name: "Past",
      season: 2024,
      status: "finished",
      syncedAt: "2026-10-08T01:00:00.000+00:00",
    },
  ],
};

const OFF = { matchupAndLeague: false, players: false, projections: false };
const ON = { matchupAndLeague: true, players: true, projections: false };
const NONE_SAVED = {
  selectedLeagueKey: null as string | null,
  selectedTeamKey: null as string | null,
  display: {},
};

function setup(
  path: string,
  preferences = {
    selectedLeagueKey: null as string | null,
    selectedTeamKey: null as string | null,
    display: {},
  },
  features = OFF
) {
  const saved: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/me/preferences") {
        saved.push(JSON.parse(String(init.body)));
        return jsonResponse(saved.at(-1));
      }
      if (url === "/api/leagues") return jsonResponse(LEAGUES);
      return jsonResponse({
        user: { id: "u", displayName: null, email: null },
        yahoo: { connected: true },
        features,
        preferences,
      });
    })
  );
  const location = memoryLocation({ path, record: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <Router hook={location.hook}>{children}</Router>
    </QueryClientProvider>
  );
  return { ...renderHook(() => useLeagueSelection(), { wrapper }), location, saved };
}

afterEach(() => vi.unstubAllGlobals());

describe("useLeagueSelection", () => {
  it("shows a deep link as it is", async () => {
    const { result, location } = setup("/leagues/454.l.9/teams/454.l.9.t.7/3");

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.selection).toEqual({
      leagueKey: "454.l.9",
      teamKey: "454.l.9.t.7",
      screen: "league",
      scope: 3,
      day: "today",
    });
    expect(location.history).toEqual(["/leagues/454.l.9/teams/454.l.9.t.7/3"]);
  });

  it("opens a first visit on Matchup Today when daily stats are wired", async () => {
    const { result, location } = setup("/", NONE_SAVED, ON);

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.screens).toEqual(["matchup", "players", "league"]);
    await waitFor(() =>
      expect(location.history).toEqual(["/leagues/466.l.1/teams/466.l.1.t.3/matchup/today"])
    );
  });

  it("moves between screens and days in the URL, so back returns", async () => {
    const { result, location } = setup(
      "/leagues/466.l.1/teams/466.l.1.t.3/matchup/today",
      NONE_SAVED,
      ON
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.select({ day: "yesterday" }));
    act(() => result.current.select({ screen: "players" }));

    await waitFor(() =>
      expect(location.history).toEqual([
        "/leagues/466.l.1/teams/466.l.1.t.3/matchup/today",
        "/leagues/466.l.1/teams/466.l.1.t.3/matchup/yesterday",
        "/leagues/466.l.1/teams/466.l.1.t.3/players",
      ])
    );
  });

  it("replaces a link to a screen that isn't wired with the League screen", async () => {
    const { result, location } = setup("/leagues/466.l.1/teams/466.l.1.t.3/matchup/week");

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.selection?.screen).toBe("league");
    await waitFor(() =>
      expect(location.history).toEqual(["/leagues/466.l.1/teams/466.l.1.t.3/current"])
    );
  });

  it("sends a first visit to the saved choice and replaces the entry, so back does not bounce", async () => {
    const { result, location } = setup("/", {
      selectedLeagueKey: "454.l.9",
      selectedTeamKey: "454.l.9.t.2",
      display: {},
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    await waitFor(() =>
      expect(location.history).toEqual(["/leagues/454.l.9/teams/454.l.9.t.2/current"])
    );
  });

  it("navigates on a change so back returns, and saves a changed league as the next start", async () => {
    const { result, location, saved } = setup("/leagues/466.l.1/teams/466.l.1.t.3/season");
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.setScope(5));
    act(() => result.current.select({ leagueKey: "454.l.9" }));

    await waitFor(() =>
      expect(location.history).toEqual([
        "/leagues/466.l.1/teams/466.l.1.t.3/season",
        "/leagues/466.l.1/teams/466.l.1.t.3/5",
        "/leagues/454.l.9/teams/454.l.9.t.2/5",
      ])
    );
    await waitFor(() =>
      expect(saved).toEqual([
        { selectedLeagueKey: "454.l.9", selectedTeamKey: "454.l.9.t.2", display: {} },
      ])
    );

    act(() => location.navigate("/leagues/466.l.1/teams/466.l.1.t.3/5"));
    await waitFor(() => expect(result.current.selection?.leagueKey).toBe("466.l.1"));
  });

  it("does not save when only the scope changes", async () => {
    const { result, saved } = setup("/leagues/466.l.1/teams/466.l.1.t.3/season");
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.setScope("current"));

    await waitFor(() => expect(result.current.selection?.scope).toBe("current"));
    expect(saved).toEqual([]);
  });

  it("reports no leagues and load errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/leagues"
          ? jsonResponse({ leagues: [] })
          : jsonResponse({
              user: { id: "u", displayName: null, email: null },
              yahoo: { connected: true },
              features: { matchupAndLeague: false, players: false, projections: false },
              preferences: { selectedLeagueKey: null, selectedTeamKey: null, display: {} },
            })
      )
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <Router hook={memoryLocation({ path: "/" }).hook}>{children}</Router>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useLeagueSelection(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("no-leagues"));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ code: "UNAUTHORIZED", message: "x", requestId: "r" }, 401))
    );
    const failing = renderHook(() => useLeagueSelection(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <Router hook={memoryLocation({ path: "/" }).hook}>{children}</Router>
        </QueryClientProvider>
      ),
    });
    await waitFor(() => expect(failing.result.current.status).toBe("error"));
    expect(failing.result.current.error).toMatchObject({ code: "UNAUTHORIZED" });
  });
});
