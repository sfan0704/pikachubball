/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { readFileSync } from "node:fs";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FreshnessProvider } from "../../../client/src/api/freshness";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSeasonTable, parseWeekTable } from "../../../server/fantasy/league-tables";
import { AuthProvider } from "../../../client/src/lib/auth";
import LeaguePage from "../../../client/src/pages/LeaguePage";
import type { DailyStatsSource } from "../../../server/fantasy/daily-stats-source";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
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
  status: "active",
  syncedAt: "2026-10-08T01:00:00.000+00:00",
};
const ME = (connected = true, dailyStats = false) => ({
  user: { id: "u1", displayName: "Tester", email: null },
  yahoo: { connected },
  features: { matchupAndLeague: dailyStats, players: dailyStats, projections: false },
  preferences: { selectedLeagueKey: null, selectedTeamKey: null, display: {} },
});
interface Backend {
  leagues?: unknown[];
  connected?: boolean;
  tableError?: { code: string; status: number };
  dailyStats?: boolean;
}

const fixtureSource: DailyStatsSource = new FixtureDailyStatsSource({ now: () => Date.now() });

/** The fixture source's answer for a daily-stats path, stamped like the server stamps it. */
async function dailyStatsAnswer(url: string): Promise<Response | null> {
  const stamp = <T extends object>(data: T) => jsonResponse({ ...data, fetchedAt: AT });
  const day = /\/teams\/([^/]+)\/days\/([\d-]+)$/.exec(url);
  if (day) {
    return stamp(await fixtureSource.getTeamDay(LEAGUE_KEY, decodeURIComponent(day[1]), day[2]));
  }
  if (url.endsWith("/weeks")) return stamp(await fixtureSource.getWeeks(LEAGUE_KEY));
  if (url.includes("/players?")) {
    return stamp(
      await fixtureSource.listPlayers(LEAGUE_KEY, {
        status: "available",
        sort: "actualRank",
        start: 0,
      })
    );
  }
  return null;
}

function startBackend(options: Backend = {}) {
  const stored = options.leagues ?? [LEAGUE];
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requests.push(url);
      if (url === "/api/auth/me") return jsonResponse({ user: { id: "u1", username: "u" } });
      if (url === "/api/me") return jsonResponse(ME(options.connected ?? true, options.dailyStats));
      const dailyStats = await dailyStatsAnswer(url);
      if (dailyStats) return dailyStats;
      if (url === "/api/leagues") return jsonResponse({ leagues: stored });
      if (url === "/api/leagues?refresh=true") return jsonResponse({ leagues: [LEAGUE] });
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
      <FreshnessProvider>
        <AuthProvider>
          <Router hook={location.hook}>
            <LeaguePage />
          </Router>
        </AuthProvider>
      </FreshnessProvider>
    </QueryClientProvider>
  );
  return location;
}

afterEach(() => vi.unstubAllGlobals());

describe("LeaguePage", () => {
  it("shows no screen navigation while daily stats aren't wired", async () => {
    startBackend();
    renderPage(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/season`);

    await screen.findAllByTestId(/^row-ranking-/);

    expect(screen.queryByRole("navigation", { name: "Screens" })).not.toBeInTheDocument();
  });

  it("opens on Matchup Today and moves between screens and days", async () => {
    startBackend({ dailyStats: true });
    const location = renderPage("/");

    const nav = await screen.findByRole("navigation", { name: "Screens" });
    expect(within(nav).getByRole("link", { name: "Matchup" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(await screen.findByTestId(`column-${MY_TEAM}`)).toHaveTextContent("A. Knoll");
    expect(location.history?.at(-1)).toBe(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/matchup/today`);

    await userEvent.click(screen.getByRole("link", { name: "Week" }));
    expect(await screen.findByLabelText("Week")).toHaveValue("5");
    expect(await screen.findByTestId(`column-${MY_TEAM}`)).toHaveTextContent("A. Knoll");

    await userEvent.click(within(nav).getByRole("link", { name: "Players" }));
    expect(await screen.findByTestId("players-list")).toBeInTheDocument();

    await userEvent.click(within(nav).getByRole("link", { name: "League" }));
    expect(await screen.findAllByTestId(/^row-ranking-/)).toHaveLength(14);
    expect(location.history?.at(-1)).toBe(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/current`);
  });
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

  it("shows League as the board alone, with no view tabs", async () => {
    startBackend({ dailyStats: true });
    renderPage(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/season`);

    expect(await screen.findByTestId("card-league-rankings")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("loads another period when it is chosen and records it in the URL", async () => {
    const requests = startBackend();
    const location = renderPage(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/season`);
    await screen.findAllByTestId(/^row-ranking-/);

    await userEvent.selectOptions(screen.getByLabelText("Time period"), "1");

    await waitFor(() => expect(requests).toContain(`/api/leagues/${LEAGUE_KEY}/1`));
    expect(location.history?.at(-1)).toBe(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/1`);
  });

  it("opens the account controls from the header", async () => {
    startBackend();
    renderPage(`/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/season`);
    await screen.findAllByTestId(/^row-ranking-/);

    await userEvent.click(screen.getByRole("button", { name: "Account" }));

    const dialog = await screen.findByRole("dialog", { name: "Account" });
    expect(within(dialog).getByRole("button", { name: "Disconnect Yahoo" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete account" })).toBeInTheDocument();
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
