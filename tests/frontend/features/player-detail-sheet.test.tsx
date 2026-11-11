/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyPlayer } from "../../../shared/api/daily-stats-values";
import type { DailyStatsSource } from "../../../server/fantasy/daily-stats-source";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
import { PlayerDetailSheet } from "../../../client/src/features/daily-stats/PlayerDetailSheet";
import { PlayerButton } from "../../../client/src/features/daily-stats/PlayerButton";
import { fixedClock } from "../../support/clock";
import { jsonResponse } from "../../support/fetch";

const LEAGUE = "466.l.100000";
const TEAM = `${LEAGUE}.t.11`;
// 3 pm Eastern on Wednesday, Nov 11.
const AT = "2026-11-11T20:00:00.000Z";
const TODAY = "2026-11-11";
const source: DailyStatsSource = new FixtureDailyStatsSource(fixedClock(AT));

async function answer(url: string): Promise<object> {
  const { pathname, searchParams } = new URL(url, "http://app.test");
  const path = decodeURIComponent(pathname).replace(`/api/leagues/${LEAGUE}`, "");
  const players = searchParams.get("players")?.split(",") ?? [];
  const routes: Record<string, () => Promise<object>> = {
    "/games": () => source.getGameLogs(LEAGUE, players),
    "/player-stats/season": () => source.getPlayerStats(LEAGUE, "season", players),
    "/weeks": () => source.getWeeks(LEAGUE),
  };
  return { ...(await routes[path]()), fetchedAt: AT };
}

/** The fixture team's player in a slot: 3 is GTD on DEN, 4 is on PHX with no game today. */
async function rosterPlayer(slot: number): Promise<DailyPlayer> {
  const day = await source.getTeamDay(LEAGUE, TEAM, TODAY);
  return day.players[slot - 1].player;
}

function renderSheet(player: DailyPlayer | null, viewDate = TODAY) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <PlayerDetailSheet
        leagueKey={LEAGUE}
        player={player}
        viewDate={viewDate}
        onClose={onClose}
        onPickLeague={vi.fn()}
      />
    </QueryClientProvider>
  );
  return { onClose };
}

beforeEach(() => {
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

describe("the player detail sheet", () => {
  it("shows the nine categories, the game lists and today's injury tag", async () => {
    renderSheet(await rosterPlayer(3));

    const sheet = await screen.findByRole("dialog", { name: "Casey Knoll" });
    const table = await within(sheet).findByTestId("player-detail-stats");
    expect(within(table).getAllByRole("row")).toHaveLength(10);
    expect(within(table).getByRole("rowheader", { name: "FG%" })).toBeTruthy();
    expect(within(sheet).getByTestId("player-detail-status-season")).toHaveTextContent("12 GP");
    expect(within(sheet).getByRole("link", { name: /GTD, Ankle/ })).toHaveAttribute(
      "href",
      "https://sports.yahoo.com/nba/players/11103/"
    );
    expect(within(sheet).getByRole("region", { name: "Recent games" })).toBeTruthy();
    expect(within(sheet).getByRole("region", { name: "Today and next" })).toBeTruthy();
  });

  it("says no game today for a player whose team is off", async () => {
    renderSheet(await rosterPlayer(4));

    const sheet = await screen.findByRole("dialog");
    expect(await within(sheet).findByTestId("player-detail-status-today")).toHaveTextContent(
      "No game"
    );
  });

  it("hides the injury tag when opened from a past date", async () => {
    renderSheet(await rosterPlayer(3), "2026-11-10");

    const sheet = await screen.findByRole("dialog");
    await within(sheet).findByTestId("player-detail-stats");
    expect(within(sheet).queryByTestId("injury-tag")).toBeNull();
  });

  it("works for an available player and closes on request", async () => {
    const { players } = await source.listPlayers(LEAGUE, {
      status: "available",
      sort: "actualRank",
      start: 0,
    });
    const freeAgent = players.find((entry) => entry.ownership.kind === "freeAgent");
    const { onClose } = renderSheet(freeAgent?.player ?? null);

    const sheet = await screen.findByRole("dialog");
    await within(sheet).findByTestId("player-detail-stats");
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(within(sheet).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("stays closed without a player", () => {
    renderSheet(null);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("a player row", () => {
  it("opens the player and shows the injury tag only when asked", async () => {
    const player = await rosterPlayer(3);
    const onOpen = vi.fn();
    const { rerender } = render(<PlayerButton player={player} showInjury onOpen={onOpen} />);

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole("button", { name: /Casey Knoll/ }));
    expect(onOpen).toHaveBeenCalledWith(player);
    expect(screen.getByTestId("injury-tag")).toHaveTextContent("GTD");

    rerender(<PlayerButton player={player} showInjury={false} onOpen={onOpen} />);
    expect(screen.queryByTestId("injury-tag")).toBeNull();
  });
});
