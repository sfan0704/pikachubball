/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { readFileSync } from "node:fs";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rankings } from "@shared/domain";
import type { DailyStatsSource } from "../../../server/fantasy/daily-stats-source";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
import { parseSeasonTable, parseWeekTable } from "../../../server/fantasy/league-tables";
import { FreshnessProvider } from "../../../client/src/api/freshness";
import { LeagueBoard } from "../../../client/src/features/daily-stats/LeagueBoard";
import { LeagueExplanation } from "../../../client/src/features/daily-stats/LeagueExplanation";
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
  const data = day
    ? await source.getTeamDay(LEAGUE, defined(day[1]), defined(day[2]))
    : moves
      ? await source.getTransactions(LEAGUE, defined(moves[1]))
      : path === "/draft"
        ? await source.getDraft(LEAGUE)
        : await source.getPlayerStats(LEAGUE, "season", players);
  return { ...data, fetchedAt: AT };
}

function stubServer() {
  const fetchMock = vi.fn(async (url: string) => jsonResponse(await answer(url)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderBoard(table = SEASON) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FreshnessProvider>
        <LeagueBoard
          table={table}
          leagueKey={LEAGUE}
          myTeamKey={MINE}
          periodLabel="Season to date"
          onPickLeague={() => undefined}
        />
      </FreshnessProvider>
    </QueryClientProvider>
  );
}

function rowKeys(): string[] {
  return screen
    .getAllByTestId(/^row-ranking-/)
    .map((row) => defined(row.getAttribute("data-testid")).replace("row-ranking-", ""));
}

afterEach(() => vi.unstubAllGlobals());

describe("LeagueBoard", () => {
  it("shows ten tiles with the user's ranks and the overall list by strength with records", async () => {
    stubServer();
    renderBoard();

    const tiles = within(screen.getByRole("group", { name: "Rank by" })).getAllByRole("button");
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      "Overallyour rank 4",
      "FG%your rank 4",
      "FT%your rank 12",
      "3PMyour rank 11",
      "PTSyour rank 3",
      "REByour rank 2",
      "ASTyour rank 7",
      "STLyour rank 5",
      "BLKyour rank 5",
      "TOyour rank 10",
    ]);
    expect(tiles[0]).toHaveAttribute("aria-pressed", "true");
    expect(rowKeys()).toEqual(rankings(SEASON).map((team) => team.teamKey));
    const mine = screen.getByTestId(`row-ranking-${MINE}`);
    expect(within(mine).getByText("(you)")).toHaveClass("sr-only");
    await waitFor(() => expect(within(mine).getByTestId("row-value")).toHaveTextContent("36–27–0"));
    expect(mine).toHaveTextContent("FG%47.9%");
  });

  it("ranks every team in a category when its tile is picked, sharing tied ranks", async () => {
    stubServer();
    renderBoard(WEEK);
    const user = userEvent.setup();

    await user.click(screen.getByTestId("tile-to"));

    expect(screen.getByTestId("tile-to")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("board-title")).toHaveTextContent("TO");
    const ranks = screen
      .getAllByTestId(/^row-ranking-/)
      .map((row) => within(row).getByTestId("row-rank").textContent);
    expect(ranks).toEqual([
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
    expect(screen.getByTestId(`row-ranking-${MINE}`)).toHaveTextContent("7");
  });

  it("explains what the ranking measures", async () => {
    render(<LeagueExplanation />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "How to read this" }));

    const dialog = screen.getByRole("dialog", { name: "Category ranks" });
    expect(dialog).toHaveTextContent(/lower total is stronger/);
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
