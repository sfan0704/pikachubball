/**
 * @vitest-environment happy-dom
 */
import React, { useState } from "react";
import { readFileSync } from "node:fs";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DailyStatsSource } from "../../../server/fantasy/daily-stats-source";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
import { parseSeasonTable, parseWeekTable } from "../../../server/fantasy/league-tables";
import { FreshnessProvider } from "../../../client/src/api/freshness";
import { LeagueBoard } from "../../../client/src/features/daily-stats/LeagueBoard";
import { LeagueExplanation } from "../../../client/src/features/daily-stats/LeagueExplanation";
import {
  DEFAULT_BOARD,
  type LeagueBoardState,
} from "../../../client/src/features/league/league-board-state";
import { fixedClock } from "../../support/clock";
import { jsonResponse } from "../../support/fetch";
import { defined } from "../../support/defined";

const LEAGUE = "466.l.100000";
const MINE = `${LEAGUE}.t.11`;
const AT = "2026-11-11T20:00:00.000Z";
const source: DailyStatsSource = new FixtureDailyStatsSource(fixedClock(AT));

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`tests/backend/fixtures/yahoo/${name}.json`, "utf8"));
}

const SEASON = parseSeasonTable(fixture("league-season"), AT);
/** The current week of the recording has tied teams overall and in categories. */
const WEEK = parseWeekTable(fixture("league-current-week"), AT);
const WEEK_1 = parseWeekTable(fixture("league-week-1"), AT);

/** What the server answers for each path these screens call. */
async function answer(url: string): Promise<object> {
  const { pathname, searchParams } = new URL(url, "http://app.test");
  const path = decodeURIComponent(pathname).replace(`/api/leagues/${LEAGUE}`, "");
  const players = searchParams.get("players")?.split(",") ?? [];
  const day = /^\/teams\/([^/]+)\/days\/(.+)$/.exec(path);
  const moves = /^\/teams\/([^/]+)\/transactions$/.exec(path);
  if (path === "/season") {
    return SEASON;
  }
  if (path === "/current") {
    return WEEK;
  }
  if (/^\/\d+$/.test(path)) {
    return WEEK_1;
  }
  const data = day
    ? await source.getTeamDay(LEAGUE, defined(day[1]), defined(day[2]))
    : moves
      ? await source.getTransactions(LEAGUE, defined(moves[1]))
      : path === "/draft"
        ? await source.getDraft(LEAGUE)
        : await source.getPlayerStats(LEAGUE, "season", players);
  return { ...data, fetchedAt: AT };
}

function stubServer({ failWeeks = false } = {}) {
  const fetchMock = vi.fn(async (url: string) =>
    failWeeks && /\/\d+$/.test(url)
      ? jsonResponse({ error: { code: "UPSTREAM_UNAVAILABLE", message: "Yahoo is down" } }, 503)
      : jsonResponse(await answer(url))
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The board with its view, sort and category held the way the URL would hold them. */
function Board({ table, initial }: { table: typeof SEASON; initial: LeagueBoardState }) {
  const [board, setBoard] = useState(initial);
  return (
    <LeagueBoard
      table={table}
      leagueKey={LEAGUE}
      myTeamKey={MINE}
      periodLabel="Season to date"
      board={board}
      boardHref={(next) => `/league?view=${next.view}`}
      onBoard={setBoard}
      onPickLeague={() => undefined}
      tableFailed={false}
    />
  );
}

function renderBoard(table = SEASON, initial: LeagueBoardState = DEFAULT_BOARD) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FreshnessProvider>
        <Board table={table} initial={initial} />
      </FreshnessProvider>
    </QueryClientProvider>
  );
}

afterEach(() => vi.unstubAllGlobals());

const cellsOf = (testId: string) =>
  screen
    .getAllByTestId(/^standings-row-/)
    .map((row) => within(row).getByTestId(testId).textContent);

describe("LeagueBoard", () => {
  it("shows Season standings by Yahoo's record, then all-play and luck from every week", async () => {
    const fetchMock = stubServer();
    renderBoard();

    const mine = screen.getByTestId(`standings-row-${MINE}`);
    expect(within(mine).getByText("(you)")).toHaveClass("sr-only");
    expect(within(mine).getByTestId("row-record")).toHaveTextContent("36–27–0");
    const ranks = cellsOf("row-rank").map(Number);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    await waitFor(() =>
      expect(within(mine).getByTestId("row-all-play")).toHaveTextContent(/^\d+(st|nd|rd|th)$/)
    );
    expect(within(mine).getByTestId("row-luck")).toHaveTextContent(/^([+−]\d+\.\d|0)$/);
    const weeks = fetchMock.mock.calls
      .map(([url]) => url)
      .filter((url) => /\/(\d+|current)$/.test(url));
    expect(weeks).toHaveLength(SEASON.settings.currentWeek - SEASON.settings.startWeek + 1);
  });

  it("keeps the record when a week fails, and says so instead of showing all-play or luck", async () => {
    stubServer({ failWeeks: true });
    renderBoard();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(cellsOf("row-all-play").every((text) => text === "—")).toBe(true);
    expect(cellsOf("row-luck").every((text) => text === "—")).toBe(true);
    expect(cellsOf("row-record")).toContain("36–27–0");
  });

  it("sorts by a column header and marks it as the sort", async () => {
    stubServer();
    renderBoard(WEEK);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Luck" }));

    expect(screen.getByRole("columnheader", { name: "Luck" })).toHaveAttribute(
      "aria-sort",
      "descending"
    );
    expect(screen.getByRole("columnheader", { name: "W–L–T" })).toHaveAttribute(
      "aria-sort",
      "none"
    );
    const luck = cellsOf("row-luck").map((text) => Number(defined(text).replace("−", "-")));
    expect(luck).toEqual([...luck].sort((a, b) => b - a));

    await user.click(screen.getByRole("button", { name: "All-play" }));
    const places = cellsOf("row-all-play").map((text) => parseInt(defined(text), 10));
    expect(places).toEqual([...places].sort((a, b) => a - b));
  });

  it("links the two views and shows the category rank grid", () => {
    stubServer();
    renderBoard(WEEK, { ...DEFAULT_BOARD, view: "categories" });

    const views = within(screen.getByRole("navigation", { name: "League view" })).getAllByRole(
      "link"
    );
    expect(views.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Standings", "/league?view=standings"],
      ["Categories", "/league?view=categories"],
    ]);
    expect(views[1]).toHaveAttribute("aria-current", "page");
    const grid = screen.getByRole("table", { name: "Category ranks" });
    expect(within(grid).getAllByRole("columnheader")).toHaveLength(
      WEEK.settings.categories.length + 1
    );
    expect(screen.getAllByTestId(/^grid-row-/)).toHaveLength(WEEK.teams.length);
  });

  it("sorts the grid by a category with its totals, and clears it on a second tap", async () => {
    stubServer();
    renderBoard(WEEK, { ...DEFAULT_BOARD, view: "categories" });
    const user = userEvent.setup();
    const ranksIn = (statId: string) =>
      screen.getAllByTestId(/^grid-row-/).map((row) => {
        const index = WEEK.settings.categories.findIndex((category) => category.statId === statId);
        return within(row).getAllByRole("cell")[index]?.textContent;
      });

    await user.click(screen.getByRole("button", { name: "TO" }));

    expect(screen.getByRole("columnheader", { name: "TO" })).toHaveAttribute(
      "aria-sort",
      "ascending"
    );
    // Three teams share 11th in turnovers this week; the next rank is skipped.
    expect(ranksIn("19")).toEqual([
      "1",
      "2",
      "3",
      "4",
      "4",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "11",
      "11",
      "14",
    ]);
    expect(screen.getAllByTestId("row-total")).toHaveLength(WEEK.teams.length);

    await user.click(screen.getByRole("button", { name: "TO" }));
    expect(screen.queryAllByTestId("row-total")).toHaveLength(0);
    expect(screen.getByRole("columnheader", { name: "TO" })).toHaveAttribute("aria-sort", "none");
  });

  it("explains how to read League", async () => {
    render(<LeagueExplanation />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "How to read this" }));

    const dialog = screen.getByRole("dialog", { name: "How to read League" });
    expect(dialog).toHaveTextContent(/All-play/);
    expect(dialog).toHaveTextContent(/share a rank/);
  });

  it("opens a team's ranks, totals and roster with acquisitions and season averages", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(AT) });
    stubServer();
    renderBoard();
    const user = userEvent.setup();

    await user.click(screen.getByTestId(`row-ranking-${LEAGUE}.t.9`));

    const dialog = screen.getByRole("dialog", { name: "Team 9" });
    expect(within(dialog).getAllByRole("listitem").length).toBeGreaterThanOrEqual(9);
    const players = await within(dialog).findAllByTestId("popover-player");
    expect(players).toHaveLength(13);
    await waitFor(() => expect(players[0]).toHaveTextContent(/Round 1/));
    expect(dialog).toHaveTextContent(/Free agent/);
    expect(dialog).toHaveTextContent(/Waivers \$4/);
    await waitFor(() => expect(players[0]).toHaveTextContent(/\d+\.\d PTS · \d+\.\d REB/));
    vi.useRealTimers();
  });
});
