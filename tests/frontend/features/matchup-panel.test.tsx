/**
 * @vitest-environment happy-dom
 */
import React, { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyPlayer } from "../../../shared/api/daily-stats-values";
import { statPeriodSchema } from "../../../shared/api/daily-stats";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
import { FreshnessProvider } from "../../../client/src/api/freshness";
import { MatchupDayBoard } from "../../../client/src/features/daily-stats/MatchupDayBoard";
import { fixedClock } from "../../support/clock";
import { jsonResponse } from "../../support/fetch";
import { buildLeagueSettings, buildTeamTable } from "../../support/builders";

const LEAGUE = "466.l.1";
const ME = `${LEAGUE}.t.1`;
const TODAY = "2026-11-11";
// 3 pm Eastern on Wednesday, Nov 11.
const AT = "2026-11-11T20:00:00.000Z";
const source = new FixtureDailyStatsSource(fixedClock(AT));

/** The API as the stand-in answers it: two teams in the week's table, fixture days and stats. */
async function answer(url: string): Promise<object> {
  const { pathname, searchParams } = new URL(url, "http://app.test");
  const path = decodeURIComponent(pathname).replace(`/api/leagues/${LEAGUE}`, "");
  const players = searchParams.get("players")?.split(",") ?? [];
  const day = /^\/teams\/([^/]+)\/days\/([\d-]+)$/.exec(path);
  const stats = /^\/player-stats\/(\w+)$/.exec(path);
  if (path === "/current") {
    return buildTeamTable([{ pts: 400 }, { pts: 380 }], {
      settings: buildLeagueSettings({ leagueKey: LEAGUE }),
    });
  }
  const body = day
    ? await source.getTeamDay(LEAGUE, day[1], day[2])
    : stats
      ? await source.getPlayerStats(LEAGUE, statPeriodSchema.parse(stats[1]), players)
      : path === "/games"
        ? await source.getGameLogs(LEAGUE, players)
        : await source.getWeeks();
  return { ...body, fetchedAt: AT };
}

/** The board as Matchup holds it: the last opened player in screen state. */
function Board({ showPanel, opened = null }: { showPanel: boolean; opened?: DailyPlayer | null }) {
  const [openPlayer, setOpenPlayer] = useState<DailyPlayer | null>(opened);
  return (
    <MatchupDayBoard
      leagueKey={LEAGUE}
      teamKey={ME}
      date={TODAY}
      isToday
      dateLabel="Today"
      now={Date.parse(AT)}
      onPickLeague={vi.fn()}
      onOpenPlayer={setOpenPlayer}
      openPlayer={openPlayer}
      showPanel={showPanel}
      dayBar={null}
    />
  );
}

function renderBoard(props: { showPanel: boolean; opened?: DailyPlayer | null }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FreshnessProvider>
        <Board {...props} />
      </FreshnessProvider>
    </QueryClientProvider>
  );
}

/** The first counted player in your column, as the row's button names them. */
async function topOfMyColumn(): Promise<string> {
  const counted = await within(await screen.findByTestId(`column-${ME}`)).findByTestId(
    "counted-players"
  );
  const label = within(counted).getAllByRole("button")[0].getAttribute("aria-label") ?? "";
  return label.replace(/: open player detail$/, "");
}

async function expectPanelShows(name: string) {
  const panel = await screen.findByTestId("player-panel");
  expect(await within(panel).findByRole("heading", { level: 2, name })).toBeInTheDocument();
  const current = screen
    .getAllByRole("button", { name: /open player detail/ })
    .filter((button) => button.getAttribute("aria-current") === "true");
  expect(current.map((button) => button.getAttribute("aria-label"))).toEqual([
    `${name}: open player detail`,
  ]);
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

describe("Matchup's player details panel", () => {
  it("shows the category's top contributor until a player is picked, then that player", async () => {
    renderBoard({ showPanel: true });
    const top = await topOfMyColumn();
    await expectPanelShows(top);

    const other = within(screen.getByTestId(`column-${ME}`))
      .getAllByRole("button", { name: /open player detail/ })
      .find((button) => !button.getAttribute("aria-label")?.startsWith(top));
    const name = (other?.getAttribute("aria-label") ?? "").replace(/: open player detail$/, "");
    await userEvent.click(other as HTMLElement);
    await expectPanelShows(name);
  });

  it("falls back to the top contributor when the picked player isn't on either roster", async () => {
    const elsewhere: DailyPlayer = {
      playerKey: "466.p.999999",
      name: "Nobody Listed",
      positions: ["C"],
      nbaTeam: "BOS",
      injuryToday: null,
    };
    renderBoard({ showPanel: true, opened: elsewhere });
    await expectPanelShows(await topOfMyColumn());
    expect(screen.queryByText("Nobody Listed")).not.toBeInTheDocument();
  });

  it("has no panel and outlines no row below lg", async () => {
    renderBoard({ showPanel: false });
    await topOfMyColumn();
    expect(screen.queryByTestId("player-panel")).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole("button", { name: /open player detail/ })
        .some((button) => button.hasAttribute("aria-current"))
    ).toBe(false);
  });
});
