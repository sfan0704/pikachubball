/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playerListQuerySchema, statPeriodSchema } from "../../../shared/api/daily-stats";
import type { DailyStatsSource } from "../../../server/fantasy/daily-stats-source";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
import { FreshnessProvider } from "../../../client/src/api/freshness";
import { PlayersScreen } from "../../../client/src/features/daily-stats/PlayersScreen";
import { fixedClock } from "../../support/clock";
import { jsonResponse } from "../../support/fetch";

const LEAGUE = "466.l.100000";
// 3 pm Eastern on Wednesday, Nov 11.
const AT = "2026-11-11T20:00:00.000Z";
const source: DailyStatsSource = new FixtureDailyStatsSource(fixedClock(AT));
const requests: string[] = [];

async function answer(url: string): Promise<object> {
  const { pathname, searchParams } = new URL(url, "http://app.test");
  const path = decodeURIComponent(pathname).replace(`/api/leagues/${LEAGUE}`, "");
  requests.push(`${path}?${searchParams.toString()}`);
  const players = searchParams.get("players")?.split(",") ?? [];
  const stats = /^\/player-stats\/(\w+)$/.exec(path);
  const body = stats
    ? await source.getPlayerStats(LEAGUE, statPeriodSchema.parse(stats[1]), players)
    : path === "/players"
      ? await source.listPlayers(
          LEAGUE,
          playerListQuerySchema.parse(Object.fromEntries(searchParams))
        )
      : path === "/schedule"
        ? await source.getSchedule(LEAGUE)
        : await source.getWeeks(LEAGUE);
  return { ...body, fetchedAt: AT };
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FreshnessProvider>
        <PlayersScreen leagueKey={LEAGUE} onPickLeague={vi.fn()} />
      </FreshnessProvider>
    </QueryClientProvider>
  );
}

async function list() {
  return screen.findByTestId("players-list");
}

beforeEach(() => {
  requests.length = 0;
  vi.useFakeTimers({ now: Date.parse(AT), toFake: ["Date"] });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => jsonResponse(await answer(url)))
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the Players screen", () => {
  it("lists not-owned players with waiver days, rostered % and the season averages", async () => {
    renderScreen();

    const rows = within(await list()).getAllByRole("listitem");
    expect(rows).toHaveLength(25);
    expect(screen.getByTestId("players-range")).toHaveTextContent(
      "Players 1–25 · Season average per game"
    );
    // Each team's dropped player clears waivers tomorrow, Thursday.
    expect(screen.getAllByText("Waivers until Thu").length).toBeGreaterThan(0);
    expect(screen.getAllByText("<1%").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(within(rows[0]).getByTestId("player-averages")).not.toHaveTextContent("—")
    );
    expect(requests).toContain("/players?status=available&sort=actualRank&start=0");
  });

  it("pages by 25 and back", async () => {
    const user = userEvent.setup();
    renderScreen();
    await list();

    await user.click(screen.getByRole("button", { name: "Next 25" }));
    await waitFor(() =>
      expect(screen.getByTestId("players-range")).toHaveTextContent("Players 26–44")
    );
    expect(screen.getByRole("button", { name: "Next 25" })).toBeDisabled();
    // The last free agent is inactive.
    expect(screen.getByText("Inactive")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous 25" }));
    await waitFor(() =>
      expect(screen.getByTestId("players-range")).toHaveTextContent("Players 1–25")
    );
  });

  it("shows owned players with their fantasy team", async () => {
    const user = userEvent.setup();
    renderScreen();
    await list();

    await user.click(screen.getByRole("button", { name: "Owned" }));
    await waitFor(() =>
      expect(screen.getAllByTestId("ownership")[0]).toHaveTextContent(/^Team \d+$/)
    );
    expect(requests).toContain("/players?status=owned&sort=actualRank&start=0");
  });

  it("asks Yahoo for the position and the search, starting again from the first page", async () => {
    const user = userEvent.setup();
    renderScreen();
    await list();
    await user.click(screen.getByRole("button", { name: "Next 25" }));
    await waitFor(() =>
      expect(screen.getByTestId("players-range")).toHaveTextContent("Players 26–44")
    );

    await user.selectOptions(screen.getByLabelText("Position"), "G");
    await waitFor(() =>
      expect(requests).toContain("/players?status=available&sort=actualRank&start=0&position=G")
    );
    await user.type(screen.getByRole("searchbox", { name: "Search players" }), "Rivers 30");
    await waitFor(() =>
      expect(requests).toContain(
        "/players?status=available&sort=actualRank&start=0&position=G&search=Rivers+30"
      )
    );
  });

  it("filters the page by NBA team and schedule without asking for anything, and says when nothing matches", async () => {
    const user = userEvent.setup();
    renderScreen();
    await list();
    // The NBA team choices come from the schedule.
    await waitFor(() =>
      expect(within(screen.getByLabelText("NBA team")).getAllByRole("option")).toHaveLength(9)
    );
    const asked = [...requests];

    await user.selectOptions(screen.getByLabelText("NBA team"), "PHX");
    const phx = within(await list()).getAllByRole("listitem");
    expect(phx.every((row) => within(row).getByText(/· PHX$/))).toBe(true);

    // PHX is idle today in the fixture.
    await user.click(screen.getByRole("button", { name: "Tonight" }));
    expect(screen.getByText("No players on this page match these filters.")).toBeInTheDocument();
    // Yahoo can't filter on these, so the call budget for a filter tap is 0.
    expect(requests).toEqual(asked);
  });

  it("switches the stats period", async () => {
    const user = userEvent.setup();
    renderScreen();
    await list();

    await user.click(screen.getByRole("button", { name: "Last 7" }));
    expect(screen.getByTestId("players-range")).toHaveTextContent("Last 7 days, average per game");
    await waitFor(() =>
      expect(requests.some((request) => request.startsWith("/player-stats/last7?"))).toBe(true)
    );
  });
});
