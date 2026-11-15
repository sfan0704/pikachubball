/**
 * @vitest-environment happy-dom
 */
import React, { useState, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyPlayer } from "../../../shared/api/daily-stats-values";
import type { DailyStatsSource } from "../../../server/fantasy/daily-stats-source";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
import { parseSeasonTable, parseWeekTable } from "../../../server/fantasy/league-tables";
import { FreshnessProvider } from "../../../client/src/api/freshness";
import { DetailsPanel } from "../../../client/src/features/daily-stats/DetailsPanel";
import { PlayerButton } from "../../../client/src/features/daily-stats/PlayerButton";
import { PlayerDetails } from "../../../client/src/features/daily-stats/PlayerDetails";
import { PlayerDetailSheet } from "../../../client/src/features/daily-stats/PlayerDetailSheet";
import { TeamDetails } from "../../../client/src/features/daily-stats/TeamDetails";
import { TeamPopover } from "../../../client/src/features/daily-stats/TeamPopover";
import { fixedClock } from "../../support/clock";
import { jsonResponse } from "../../support/fetch";
import { defined } from "../../support/defined";

const LEAGUE = "466.l.100000";
const TEAM = `${LEAGUE}.t.11`;
// 3 pm Eastern on Wednesday, Nov 11.
const AT = "2026-11-11T20:00:00.000Z";
const TODAY = "2026-11-11";
const source: DailyStatsSource = new FixtureDailyStatsSource(fixedClock(AT));

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`tests/backend/fixtures/yahoo/${name}.json`, "utf8"));
}

const SEASON = parseSeasonTable(fixture("league-season"), AT);
const WEEK = parseWeekTable(fixture("league-current-week"), AT);
const WEEK_1 = parseWeekTable(fixture("league-week-1"), AT);

/** What the server answers for each path the player and team details call. */
async function answer(url: string): Promise<object> {
  const { pathname, searchParams } = new URL(url, "http://app.test");
  const path = decodeURIComponent(pathname).replace(`/api/leagues/${LEAGUE}`, "");
  const players = searchParams.get("players")?.split(",") ?? [];
  const day = /^\/teams\/([^/]+)\/days\/(.+)$/.exec(path);
  const moves = /^\/teams\/([^/]+)\/transactions$/.exec(path);
  const tables: Record<string, object> = { "/season": SEASON, "/current": WEEK };
  if (path in tables) {
    return defined(tables[path]);
  }
  if (/^\/\d+$/.test(path)) {
    return WEEK_1;
  }
  const routes: Record<string, () => Promise<object>> = {
    "/games": () => source.getGameLogs(LEAGUE, players),
    "/player-stats/season": () => source.getPlayerStats(LEAGUE, "season", players),
    "/weeks": () => source.getWeeks(LEAGUE),
    "/draft": () => source.getDraft(LEAGUE),
  };
  const data = day
    ? await source.getTeamDay(LEAGUE, defined(day[1]), defined(day[2]))
    : moves
      ? await source.getTransactions(LEAGUE, defined(moves[1]))
      : await defined(routes[path])();
  return { ...data, fetchedAt: AT };
}

/** Serves every path, except that `fail` answers 503 and `empty` answers with no players. */
function stubServer(fail: RegExp | null = null, empty: RegExp | null = null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (fail?.test(url)) {
        return jsonResponse(
          { error: { code: "UPSTREAM_UNAVAILABLE", message: "Yahoo is down" } },
          503
        );
      }
      const body = await answer(url);
      return jsonResponse(empty?.test(url) ? { ...body, players: [] } : body);
    })
  );
}

function renderWithData(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FreshnessProvider>{ui}</FreshnessProvider>
    </QueryClientProvider>
  );
}

/** The fixture team's player in slot 3: Casey Knoll, GTD on DEN. */
async function caseyKnoll(): Promise<DailyPlayer> {
  const day = await source.getTeamDay(LEAGUE, TEAM, TODAY);
  return defined(day.players[2]).player;
}

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse(AT), toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** What a container shows of the player details, to compare one container with another. */
async function playerContent(container: HTMLElement) {
  const table = await within(container).findByTestId("player-detail-stats");
  return {
    heading: within(container).getByRole("heading", { name: "Casey Knoll" }).tagName,
    rows: within(table)
      .getAllByRole("row")
      .map((row) => row.textContent),
    injury: within(container).getByTestId("player-detail-injury").textContent,
    lists: within(container)
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-label")),
  };
}

function PlayerPanel({ player }: { player: DailyPlayer }) {
  return (
    <DetailsPanel testId="player-panel">
      <PlayerDetails leagueKey={LEAGUE} player={player} viewDate={TODAY} onPickLeague={vi.fn()} />
    </DetailsPanel>
  );
}

/** A row that opens the player in a sheet from the given side, as a screen does. */
function OpenFromRow({ player, side }: { player: DailyPlayer; side: "bottom" | "right" }) {
  const [open, setOpen] = useState<DailyPlayer | null>(null);
  return (
    <>
      <PlayerButton player={player} showInjury={false} onOpen={setOpen} />
      <PlayerDetailSheet
        leagueKey={LEAGUE}
        player={open}
        viewDate={TODAY}
        side={side}
        onClose={() => setOpen(null)}
        onPickLeague={vi.fn()}
      />
    </>
  );
}

describe("the player details", () => {
  it("shows the same content in the phone sheet, the drawer and the panel", async () => {
    stubServer();
    const player = await caseyKnoll();
    const shown = [];
    for (const side of ["bottom", "right"] as const) {
      const { unmount } = renderWithData(<OpenFromRow player={player} side={side} />);
      await user().click(screen.getByRole("button", { name: /Casey Knoll/ }));
      shown.push(await playerContent(await screen.findByRole("dialog", { name: "Casey Knoll" })));
      unmount();
    }
    renderWithData(<PlayerPanel player={player} />);
    shown.push(await playerContent(screen.getByRole("region", { name: "Casey Knoll" })));

    expect(shown[0]?.rows).toHaveLength(10);
    expect(shown[0]?.lists).toEqual(["Recent games", "Today and next"]);
    expect(shown[1]).toEqual(shown[0]);
    expect(shown[2]).toEqual(shown[0]);
  });

  it("opens the drawer from the right, closes it on Escape or ✕ and returns focus to the row", async () => {
    stubServer();
    renderWithData(<OpenFromRow player={await caseyKnoll()} side="right" />);
    const row = screen.getByRole("button", { name: /Casey Knoll/ });

    for (const close of [() => user().keyboard("{Escape}"), () => user().click(closeButton())]) {
      // From the keyboard: happy-dom does not focus a button on a pointer click.
      row.focus();
      await user().keyboard("{Enter}");
      const drawer = await screen.findByRole("dialog", { name: "Casey Knoll" });
      expect(drawer).toHaveClass("right-0", "border-l");
      expect(drawer).toContainElement(document.activeElement as HTMLElement);
      await close();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(row).toHaveFocus());
    }
  });

  it("sits in the page as a region: no dialog, no close button, the page stays usable", async () => {
    stubServer();
    renderWithData(
      <>
        <button type="button">Elsewhere</button>
        <PlayerPanel player={await caseyKnoll()} />
      </>
    );
    const panel = screen.getByRole("region", { name: "Casey Knoll" });
    await within(panel).findByTestId("player-detail-stats");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(panel).queryByRole("button", { name: "Close" })).toBeNull();
    await user().click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
  });

  it("shows loading and then the game log's error with a retry inside the panel", async () => {
    stubServer(/\/games/);
    renderWithData(<PlayerPanel player={await caseyKnoll()} />);
    const panel = screen.getByRole("region", { name: "Casey Knoll" });

    expect(within(panel).getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(await within(panel).findByRole("button", { name: /retry|try again/i })).toBeTruthy();
    expect(within(panel).queryByTestId("player-detail-stats")).toBeNull();
  });

  it("says the game log is unavailable in the panel when it has no entry for the player", async () => {
    stubServer(null, /\/games/);
    renderWithData(<PlayerPanel player={await caseyKnoll()} />);
    const panel = screen.getByRole("region", { name: "Casey Knoll" });

    expect(await within(panel).findByText("Game log unavailable.")).toBeInTheDocument();
  });

  it("shows the categories without a season average when the season has none", async () => {
    stubServer(null, /\/player-stats\/season/);
    renderWithData(<PlayerPanel player={await caseyKnoll()} />);
    const panel = screen.getByRole("region", { name: "Casey Knoll" });

    expect(await within(panel).findByTestId("player-detail-stats")).toBeInTheDocument();
    expect(within(panel).getByTestId("player-detail-status-season")).not.toHaveTextContent("12 GP");
  });
});

function closeButton() {
  return within(screen.getByRole("dialog")).getByRole("button", { name: "Close" });
}

/** What a container shows of the team details, to compare the dialog with the panel. */
async function teamContent(container: HTMLElement) {
  await within(container).findByTestId("luck-math");
  const players = await within(container).findAllByTestId("popover-player");
  await waitFor(() => expect(players[0]).toHaveTextContent(/\d+\.\d PTS/));
  return {
    heading: within(container).getByRole("heading", { name: "Team 9" }).tagName,
    period: within(container).getByText("Season to date").textContent,
    luck: within(container).getByTestId("luck-math").textContent,
    ranks: within(container).getByRole("list", { name: "Category ranks and totals" }).textContent,
    allPlay: within(container).getByTestId("category-all-play").textContent,
    roster: players.map((player) => player.textContent),
  };
}

const TEAM_9 = `${LEAGUE}.t.9`;

describe("the team details", () => {
  it("shows the same content in the League dialog and the panel", async () => {
    stubServer();
    const { unmount } = renderWithData(
      <TeamPopover
        table={SEASON}
        leagueKey={LEAGUE}
        teamKey={TEAM_9}
        periodLabel="Season to date"
        onClose={vi.fn()}
        returnFocus={vi.fn()}
        onPickLeague={vi.fn()}
      />
    );
    const inDialog = await teamContent(screen.getByRole("dialog", { name: "Team 9" }));
    unmount();
    renderWithData(
      <DetailsPanel testId="team-panel">
        <TeamDetails
          table={SEASON}
          leagueKey={LEAGUE}
          teamKey={TEAM_9}
          periodLabel="Season to date"
          onPickLeague={vi.fn()}
        />
      </DetailsPanel>
    );
    const panel = screen.getByRole("region", { name: "Team 9" });
    const inPanel = await teamContent(panel);

    expect(inDialog.roster).toHaveLength(13);
    expect(inPanel).toEqual(inDialog);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(panel).queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("shows the roster's error with a retry inside the panel", async () => {
    stubServer(/\/days\//);
    renderWithData(
      <DetailsPanel testId="team-panel">
        <TeamDetails
          table={SEASON}
          leagueKey={LEAGUE}
          teamKey={TEAM_9}
          periodLabel="Season to date"
          onPickLeague={vi.fn()}
        />
      </DetailsPanel>
    );
    const panel = screen.getByRole("region", { name: "Team 9" });

    expect(await within(panel).findByRole("button", { name: /retry|try again/i })).toBeTruthy();
    expect(within(panel).queryByTestId("popover-player")).toBeNull();
  });
});
