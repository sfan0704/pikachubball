/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { readFileSync } from "node:fs";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSeasonTable, parseWeekTable } from "../../../server/fantasy/league-tables";
import { AuthProvider } from "../../../client/src/lib/auth";
import LeaguePage from "../../../client/src/pages/LeaguePage";
import { jsonResponse } from "../../support/fetch";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`tests/backend/fixtures/yahoo/${name}.json`, "utf8"));
}

const AT = "2025-12-11T18:00:00.000Z";
const SEASON = parseSeasonTable(fixture("league-season"), AT);
const CURRENT = parseWeekTable(fixture("league-current-week"), AT);
const WEEK_1 = parseWeekTable(fixture("league-week-1"), AT, 1);
const LEAGUE_KEY = "466.l.100000";
const MY_TEAM = `${LEAGUE_KEY}.t.11`;
const LEAGUE = {
  leagueKey: LEAGUE_KEY,
  teamKey: MY_TEAM,
  name: "Test League",
  season: 2025,
  isFinished: false,
  syncedAt: "2026-10-08T01:00:00.000+00:00",
};
const ME = (connected = true) => ({
  user: { id: "u1", displayName: "Tester", email: null },
  yahoo: { connected },
  preferences: { selectedLeagueKey: null, selectedTeamKey: null, display: {} },
});
const ROSTER = {
  fetchedAt: AT,
  roster: [
    { playerKey: "466.p.1", name: "Test Guard", position: "PG", team: "LAL", status: "active" },
  ],
};

interface Backend {
  leagues?: unknown[];
  connected?: boolean;
  tableError?: { code: string; status: number };
}

function startBackend(options: Backend = {}) {
  const stored = options.leagues ?? [LEAGUE];
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requests.push(url);
      if (url === "/api/auth/me") return jsonResponse({ user: { id: "u1", username: "u" } });
      if (url === "/api/me") return jsonResponse(ME(options.connected ?? true));
      if (url === "/api/leagues") return jsonResponse({ leagues: stored });
      if (url === "/api/leagues?refresh=true") return jsonResponse({ leagues: [LEAGUE] });
      if (url.endsWith("/roster")) return jsonResponse(ROSTER);
      if (options.tableError) {
        return jsonResponse(
          { code: options.tableError.code, message: "x", requestId: "req-1" },
          options.tableError.status
        );
      }
      if (url.endsWith("/season")) return jsonResponse(SEASON);
      if (url.endsWith("/current")) return jsonResponse(CURRENT);
      if (url.endsWith("/1")) return jsonResponse(WEEK_1);
      return jsonResponse({ code: "NOT_FOUND", message: "x", requestId: "r" }, 404);
    })
  );
  return requests;
}

function renderPage(path: string) {
  const location = memoryLocation({ path, record: true });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Router hook={location.hook}>
          <LeaguePage />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
  return location;
}

afterEach(() => vi.unstubAllGlobals());

describe("LeaguePage", () => {
  it("shows a deep link: the league header, the pickers and the rankings", async () => {
    startBackend();
    renderPage(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/season`);

    expect(await screen.findByRole("heading", { name: "Test League" })).toBeInTheDocument();
    expect(await screen.findAllByTestId(/^row-ranking-/)).toHaveLength(14);
    expect(screen.getByText(/2025 season/)).toHaveTextContent("Team 11");
    expect(screen.getByLabelText("Time period")).toHaveValue("season");
    expect(screen.getByLabelText("Viewing as")).toHaveValue(MY_TEAM);
    expect(screen.getByTestId("text-updated")).toBeInTheDocument();
  });

  it("starts a first visit from the stored league and puts it in the URL", async () => {
    startBackend();
    const location = renderPage("/");

    await screen.findAllByTestId(/^row-ranking-/);

    expect(location.history?.at(-1)).toBe(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/current`);
  });

  it("switches views without another request for the same table", async () => {
    const requests = startBackend();
    renderPage(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/1`);
    await screen.findAllByTestId(/^row-ranking-/);

    for (const name of ["heatmap", "matchup", "compare"]) {
      await userEvent.click(screen.getByRole("tab", { name }));
    }

    expect(await screen.findByTestId("card-comparison")).toBeInTheDocument();
    expect(requests.filter((url) => url.includes("/api/leagues/"))).toHaveLength(1);
  });

  it("loads another period when it is chosen and records it in the URL", async () => {
    const requests = startBackend();
    const location = renderPage(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/season`);
    await screen.findAllByTestId(/^row-ranking-/);

    await userEvent.selectOptions(screen.getByLabelText("Time period"), "1");

    await waitFor(() => expect(requests).toContain(`/api/leagues/${LEAGUE_KEY}/1`));
    expect(location.history?.at(-1)).toBe(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/1`);
  });

  it("shows the roster and the account controls", async () => {
    startBackend();
    renderPage(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/season`);
    await screen.findAllByTestId(/^row-ranking-/);

    await userEvent.click(screen.getByRole("tab", { name: "roster" }));
    expect(await screen.findByText("Test Guard")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "account" }));
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
  });

  it("looks up the leagues once when none are stored", async () => {
    const requests = startBackend({ leagues: [] });
    renderPage("/");

    expect(await screen.findByRole("heading", { name: "Test League" })).toBeInTheDocument();
    expect(requests.filter((url) => url === "/api/leagues?refresh=true")).toHaveLength(1);
  });

  it("asks for a Yahoo connection when none is stored", async () => {
    startBackend({ connected: false });
    renderPage("/");

    expect(await screen.findByText("Yahoo connection required")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in with Yahoo" })).toHaveAttribute(
      "href",
      "/api/auth/yahoo"
    );
  });

  it("keeps the header and pickers and shows the reconnect prompt when Yahoo rejects the grant", async () => {
    startBackend({ tableError: { code: "YAHOO_RECONNECT_REQUIRED", status: 401 } });
    renderPage(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/season`);

    const alert = await screen.findByRole("alert");

    expect(within(alert).getByText("Sign in with Yahoo again")).toBeInTheDocument();
    expect(within(alert).getByText("req-1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Test League" })).toBeInTheDocument();
  });
});
