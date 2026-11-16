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
import { resizeTo, START_WIDTH } from "../../support/viewport";
import {
  buildLeagueSettings,
  buildTeamTable,
  STANDARD_CATEGORIES,
  TEN_CATEGORIES,
} from "../../support/builders";

const LEAGUE = "466.l.100000";
// 3 pm Eastern on Wednesday, Nov 11.
const AT = "2026-11-11T20:00:00.000Z";
const source: DailyStatsSource = new FixtureDailyStatsSource(fixedClock(AT));
const requests: string[] = [];
let categories = STANDARD_CATEGORIES;

/** The league's current week, which names its categories. */
function currentTable() {
  return buildTeamTable([{}], { settings: buildLeagueSettings({ leagueKey: LEAGUE, categories }) });
}

async function answer(url: string): Promise<object> {
  const { pathname, searchParams } = new URL(url, "http://app.test");
  const path = decodeURIComponent(pathname).replace(`/api/leagues/${LEAGUE}`, "");
  requests.push(`${path}?${searchParams.toString()}`);
  const players = searchParams.get("players")?.split(",") ?? [];
  if (path === "/current") {
    return currentTable();
  }
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
        : path === "/games"
          ? await source.getGameLogs(LEAGUE, players)
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
  resizeTo(390);
  requests.length = 0;
  categories = STANDARD_CATEGORIES;
  vi.useFakeTimers({ now: Date.parse(AT), toFake: ["Date"] });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => jsonResponse(await answer(url)))
  );
});

afterEach(() => {
  resizeTo(START_WIDTH);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the Players screen", () => {
  it("lists not-owned players with waiver days, rostered % and the season averages", async () => {
    renderScreen();

    const rows = within(await list()).getAllByRole("listitem");
    expect(rows).toHaveLength(25);
    expect(screen.getByTestId("players-range")).toHaveTextContent("Players 1–25");
    expect(screen.getByTestId("players-count")).toHaveTextContent(
      "25 players · season avg per game"
    );
    // Each team's dropped player clears waivers tomorrow, Thursday.
    expect(screen.getAllByText("Clears Thu").length).toBeGreaterThan(0);
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

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(
      within(screen.getByRole("group", { name: "Position" })).getByRole("button", { name: "G" })
    );
    await waitFor(() =>
      expect(requests).toContain("/players?status=available&sort=actualRank&start=0&position=G")
    );
    await user.click(screen.getByRole("button", { name: /^Show \d+ players?$/ }));
    expect(screen.getByRole("button", { name: "Filters, 1 on" })).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Filters" }));
    // The NBA team choices come from the schedule.
    await waitFor(() =>
      expect(within(screen.getByLabelText("NBA team")).getAllByRole("option")).toHaveLength(9)
    );
    const asked = [...requests];

    await user.selectOptions(screen.getByLabelText("NBA team"), "PHX");
    await user.click(screen.getByRole("button", { name: /^Show \d+ players?$/ }));
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
    expect(screen.getByTestId("players-count")).toHaveTextContent("last 7 days per game");
    await waitFor(() =>
      expect(requests.some((request) => request.startsWith("/player-stats/last7?"))).toBe(true)
    );
  });

  it("badges the filters that are on and clears them without asking for anything", async () => {
    const user = userEvent.setup();
    renderScreen();
    await list();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await waitFor(() =>
      expect(within(screen.getByLabelText("NBA team")).getAllByRole("option")).toHaveLength(9)
    );
    const asked = [...requests];

    await user.selectOptions(screen.getByLabelText("NBA team"), "DEN");
    await user.selectOptions(screen.getByLabelText("Games left"), "1");
    await user.click(screen.getByRole("button", { name: /^Show \d+ players?$/ }));
    expect(screen.getByTestId("filters-badge")).toHaveTextContent("2");

    await user.click(screen.getByRole("button", { name: "Filters, 2 on" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("button", { name: "Show 25 players" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show 25 players" }));
    expect(screen.queryByTestId("filters-badge")).not.toBeInTheDocument();
    expect(requests).toEqual(asked);
  });

  it("sorts the page by a category, highest first, without asking for anything", async () => {
    const user = userEvent.setup();
    renderScreen();
    const rows = within(await list()).getAllByRole("listitem");
    await waitFor(() =>
      expect(within(rows[0]).getByTestId("player-averages")).not.toHaveTextContent("—")
    );
    const asked = [...requests];

    await user.selectOptions(screen.getByLabelText("Sort by"), "category-12");
    const points = within(await list())
      .getAllByTestId("player-averages")
      .map((cells) => Number(within(cells).getByText("PTS").nextSibling?.textContent));
    expect(points).toEqual([...points].sort((a, b) => b - a));
    expect(requests).toEqual(asked);
  });

  it("keeps the chosen sort on a page that hasn't loaded yet", async () => {
    const user = userEvent.setup();
    renderScreen();
    await list();

    await user.selectOptions(screen.getByLabelText("Sort by"), "category-12");
    await user.click(screen.getByRole("button", { name: "Next 25" }));
    await waitFor(() =>
      expect(screen.getByTestId("players-range")).toHaveTextContent("Players 26–44")
    );
    expect(screen.getByLabelText("Sort by")).toHaveValue("category-12");
    await waitFor(() => {
      const points = within(screen.getByTestId("players-list"))
        .getAllByTestId("player-averages")
        .map((cells) => Number(within(cells).getByText("PTS").nextSibling?.textContent));
      expect(points).toEqual([...points].sort((a, b) => b - a));
    });
  });

  it("shows and sorts by the league's own categories", async () => {
    categories = TEN_CATEGORIES;
    const user = userEvent.setup();
    renderScreen();
    const rows = within(await list()).getAllByRole("listitem");
    await waitFor(() => expect(within(rows[0]).getByText("PF")).toBeInTheDocument());
    expect(within(rows[0]).getByText("3PT%")).toBeInTheDocument();
    expect(within(rows[0]).queryByText("3PM")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Sort by"), "category-21");
    const fouls = within(await list())
      .getAllByTestId("player-averages")
      .map((cells) => Number(within(cells).getByText("PF").nextSibling?.textContent));
    expect(fouls).toEqual([...fouls].sort((a, b) => a - b));
  });
});

describe("the Players screen from md", () => {
  /** The first row's name button, once the page and its averages are in. */
  async function firstName(): Promise<HTMLElement> {
    const rows = within(await list()).getAllByRole("listitem");
    await waitFor(() =>
      expect(within(rows[0]).getByTestId("player-averages")).not.toHaveTextContent("—")
    );
    return within(rows[0]).getAllByRole("button")[0];
  }

  it("puts position, NBA team, games left and Clear in the toolbar, with no Filters sheet", async () => {
    resizeTo(1280);
    const user = userEvent.setup();
    renderScreen();
    await firstName();
    await waitFor(() =>
      expect(within(screen.getByLabelText("NBA team")).getAllByRole("option")).toHaveLength(9)
    );
    await screen.findByTestId("player-detail-stats");
    const asked = [...requests];

    await user.selectOptions(screen.getByLabelText("NBA team"), "PHX");
    const phx = within(await list()).getAllByRole("listitem");
    expect(phx.every((row) => within(row).getByText(/· PHX$/))).toBe(true);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByLabelText("NBA team")).toHaveValue("");
    expect(within(await list()).getAllByRole("listitem")).toHaveLength(25);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The list asks for nothing more; only the panel follows its new first player.
    const listRequests = (all: readonly string[]) =>
      all.filter((request) => !request.startsWith("/games?") && !/players=[^,]+$/.test(request));
    expect(listRequests(requests)).toEqual(listRequests(asked));
  });

  it("shows the first player in the panel until one is picked, marking the picked row", async () => {
    resizeTo(1280);
    const user = userEvent.setup();
    renderScreen();
    const first = await firstName();
    const panel = await screen.findByRole("region", { name: first.textContent ?? "" });
    expect(panel).toHaveAttribute("data-testid", "player-detail");
    expect(first).toHaveAttribute("aria-current", "true");

    const second = within(within(await list()).getAllByRole("listitem")[1]).getAllByRole(
      "button"
    )[0];
    await user.click(second);
    expect(screen.getByRole("region", { name: second.textContent ?? "" })).toBeInTheDocument();
    expect(second).toHaveAttribute("aria-current", "true");
    expect(first).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("falls back to the new first player when the picked one leaves the list, and drops the panel when none are left", async () => {
    resizeTo(1280);
    const user = userEvent.setup();
    renderScreen();
    await firstName();
    const rows = within(await list()).getAllByRole("listitem");
    const teamOf = (row: HTMLElement) =>
      /· (\w+)$/.exec(within(row).getByText(/· \w+$/).textContent ?? "")?.[1];
    const firstTeam = teamOf(rows[0]);
    const elsewhere = rows.find((row) => teamOf(row) !== firstTeam);
    if (firstTeam === undefined || elsewhere === undefined) {
      throw new Error("the fixture's first page should hold players of more than one team");
    }
    await user.click(within(elsewhere).getAllByRole("button")[0]);
    expect(within(elsewhere).getAllByRole("button")[0]).toHaveAttribute("aria-current", "true");

    await user.selectOptions(screen.getByLabelText("NBA team"), firstTeam);
    const kept = within(await list()).getAllByRole("listitem");
    const name = within(kept[0]).getAllByRole("button")[0].textContent ?? "";
    expect(screen.getByRole("region", { name })).toBeInTheDocument();
    expect(within(kept[0]).getAllByRole("button")[0]).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByRole("button", { name: "Tonight" }));
    await user.selectOptions(screen.getByLabelText("NBA team"), "PHX");
    expect(screen.getByText("No players on this page match these filters.")).toBeInTheDocument();
    expect(screen.queryByTestId("player-detail")).not.toBeInTheDocument();
  });

  it("opens the picked player in a drawer between md and lg, and shows no details unpicked", async () => {
    resizeTo(900);
    const user = userEvent.setup();
    renderScreen();
    const first = await firstName();
    expect(screen.queryByTestId("player-detail")).not.toBeInTheDocument();
    expect(requests.some((request) => request.startsWith("/games?"))).toBe(false);

    await user.click(first);
    expect(
      await screen.findByRole("dialog", { name: first.textContent ?? "" })
    ).toBeInTheDocument();
  });

  it("leaves the default pick out of the sheet when the window narrows to a phone", async () => {
    renderScreen();
    await firstName();
    resizeTo(1280);
    expect(await screen.findByTestId("player-detail")).toBeInTheDocument();

    resizeTo(390);
    await waitFor(() => expect(screen.queryByTestId("player-detail")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
