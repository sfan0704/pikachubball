/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
  type QueryKey,
} from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameLogsResponse } from "../../../shared/api/daily-stats";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
import {
  useDraft,
  useGameLogs,
  usePlayerList,
  usePlayerStats,
  useSchedule,
  useTeamDay,
  useTransactions,
  useWeeks,
} from "../../../client/src/api/daily-stats-hooks";
import { FreshnessProvider } from "../../../client/src/api/freshness";
import { useLeagueScope, useRoster } from "../../../client/src/api/hooks";
import { queryKeys } from "../../../client/src/api/query-keys";
import { fixedClock } from "../../support/clock";
import { jsonResponse } from "../../support/fetch";

/** A game's state as the game-log contract carries it (no "noGame": a missing game has no entry). */
type GameState = GameLogsResponse["players"][number]["games"][number]["state"];

const MINUTE = 60_000;
const LEAGUE = "466.l.100000";
const TEAM = `${LEAGUE}.t.11`;
const PLAYER = "466.p.11101";
const TODAY = "2026-11-11";
const AT = "2026-11-12T00:00:00.000Z"; // 7 pm Eastern on TODAY
const TIP_OFF = "2026-11-12T00:30:00.000Z";
const source = new FixtureDailyStatsSource(fixedClock(AT));

/** Game logs for one player whose game today is in the given state. */
function gameLogs(state: GameState): GameLogsResponse {
  return {
    fetchedAt: AT,
    players: [
      {
        playerKey: PLAYER,
        nbaTeam: "PHI",
        games: [
          {
            gameId: "1",
            date: TODAY,
            opponent: "BOS",
            isHome: true,
            state,
            minutes: { kind: "notYetPlayed" },
          },
        ],
      },
    ],
  };
}

const LIVE: GameState = { kind: "live", tipOff: TIP_OFF, progress: { kind: "text", text: "Q1" } };

/** A fake server: game logs in `gameState`, the fixture's team day, and queued failures for the team day. */
function stubServer(gameState: GameState) {
  const failures: Response[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/games")) {
      return jsonResponse(gameLogs(gameState));
    }
    const failure = failures.shift();
    if (failure) {
      return failure;
    }
    return jsonResponse({ ...(await source.getTeamDay(LEAGUE, TEAM, TODAY)), fetchedAt: AT });
  });
  vi.stubGlobal("fetch", fetchMock);
  const teamDayCalls = () => fetchMock.mock.calls.filter(([url]) => url.includes("/days/")).length;
  const fail = (code: string) =>
    failures.push(jsonResponse({ code, message: code, requestId: "req" }, 503));
  return { teamDayCalls, fail };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <FreshnessProvider>{children}</FreshnessProvider>
    </QueryClientProvider>
  );
  return { client, wrapper };
}

/** The fresh time and poll interval the factory gave the query under `key`. */
function timersOf(client: QueryClient, key: QueryKey) {
  const query = client.getQueryCache().find({ queryKey: key, exact: true });
  const options = query?.observers[0]?.options;
  const interval = options?.refetchInterval;
  return {
    freshFor: options?.staleTime,
    pollEvery: typeof interval === "function" && query ? interval(query) : interval,
  };
}

/** Runs timers due by now and lets each fetch, including reading its body, settle. */
async function flush() {
  for (let round = 0; round < 5; round += 1) {
    await act(() => vi.advanceTimersByTimeAsync(0));
  }
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse(AT) });
});

afterEach(() => {
  // Unmount first, so no earlier test's poll reaches the next test's server.
  cleanup();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the dataset query factory", () => {
  it("gives every dataset key its class's timers while no game is live", async () => {
    stubServer({ kind: "scheduled", tipOff: TIP_OFF });
    const { client, wrapper } = setup();
    const query = { status: "available", sort: "actualRank", start: 0 } as const;
    renderHook(
      () => {
        useTeamDay(LEAGUE, TEAM, TODAY);
        useTeamDay(LEAGUE, TEAM, "2026-11-09");
        useTeamDay(LEAGUE, TEAM, "2026-11-08");
        usePlayerStats(LEAGUE, "season", [PLAYER]);
        usePlayerList(LEAGUE, query);
        useSchedule(LEAGUE);
        useTransactions(LEAGUE, TEAM);
        useDraft(LEAGUE);
        useWeeks(LEAGUE);
        useLeagueScope(LEAGUE, "current");
        useLeagueScope(LEAGUE, 3);
        useRoster(LEAGUE, TEAM);
      },
      { wrapper }
    );
    await flush();

    const recent = { freshFor: 10 * MINUTE, pollEvery: false };
    const daily = { freshFor: 6 * 60 * MINUTE, pollEvery: false };
    const settled = { freshFor: Infinity, pollEvery: false };
    expect(timersOf(client, queryKeys.teamDay(LEAGUE, TEAM, TODAY))).toEqual(recent);
    expect(timersOf(client, queryKeys.teamDay(LEAGUE, TEAM, "2026-11-09"))).toEqual(recent);
    expect(timersOf(client, queryKeys.teamDay(LEAGUE, TEAM, "2026-11-08"))).toEqual(settled);
    expect(timersOf(client, queryKeys.playerStats(LEAGUE, "season", [PLAYER]))).toEqual(daily);
    expect(timersOf(client, queryKeys.players(LEAGUE, query))).toEqual(recent);
    expect(timersOf(client, queryKeys.schedule(LEAGUE))).toEqual(daily);
    expect(timersOf(client, queryKeys.transactions(LEAGUE, TEAM))).toEqual(recent);
    expect(timersOf(client, queryKeys.draft(LEAGUE))).toEqual(settled);
    expect(timersOf(client, queryKeys.weeks(LEAGUE))).toEqual(settled);
    expect(timersOf(client, queryKeys.leagueScope(LEAGUE, "current"))).toEqual(recent);
    expect(timersOf(client, queryKeys.leagueScope(LEAGUE, 3))).toEqual(settled);
    expect(timersOf(client, queryKeys.roster(LEAGUE, TEAM))).toEqual(recent);
  });

  it("polls every Live dataset every two minutes while a shown game is live", async () => {
    stubServer(LIVE);
    const { client, wrapper } = setup();
    renderHook(
      () => {
        useGameLogs(LEAGUE, [PLAYER]);
        useTeamDay(LEAGUE, TEAM, TODAY);
        useTeamDay(LEAGUE, TEAM, "2026-11-10");
        useLeagueScope(LEAGUE, "current");
      },
      { wrapper }
    );
    await flush();

    const live = { freshFor: 2 * MINUTE, pollEvery: 2 * MINUTE };
    expect(timersOf(client, queryKeys.gameLogs(LEAGUE, [PLAYER]))).toEqual(live);
    expect(timersOf(client, queryKeys.teamDay(LEAGUE, TEAM, TODAY))).toEqual(live);
    expect(timersOf(client, queryKeys.leagueScope(LEAGUE, "current"))).toEqual(live);
    expect(timersOf(client, queryKeys.teamDay(LEAGUE, TEAM, "2026-11-10"))).toEqual({
      freshFor: 10 * MINUTE,
      pollEvery: false,
    });
  });
});

describe("polling", () => {
  function renderToday() {
    const { client, wrapper } = setup();
    renderHook(
      () => {
        useGameLogs(LEAGUE, [PLAYER]);
        useTeamDay(LEAGUE, TEAM, TODAY);
      },
      { wrapper }
    );
    return () => client.getQueryState(queryKeys.teamDay(LEAGUE, TEAM, TODAY));
  }

  it("fetches again every two minutes while a game is live", async () => {
    const server = stubServer(LIVE);
    renderToday();
    await flush();
    expect(server.teamDayCalls()).toBe(1);

    await advance(2 * MINUTE);
    expect(server.teamDayCalls()).toBe(2);
    await advance(2 * MINUTE);
    expect(server.teamDayCalls()).toBe(3);
  });

  it("doesn't poll while the tab is hidden", async () => {
    const server = stubServer(LIVE);
    renderToday();
    await flush();

    focusManager.setFocused(false);
    await advance(10 * MINUTE);
    expect(server.teamDayCalls()).toBe(1);
  });

  it("stays quiet before tip-off and turns polling on when the game tips off", async () => {
    const server = stubServer({ kind: "scheduled", tipOff: TIP_OFF });
    renderToday();
    await flush();

    await advance(30 * MINUTE);
    expect(server.teamDayCalls()).toBe(1);
    await advance(2 * MINUTE);
    expect(server.teamDayCalls()).toBe(2);
    await advance(2 * MINUTE);
    expect(server.teamDayCalls()).toBe(3);
  });

  it("backs off 2, 4, 8 then 10 minutes while rate-limited, and resets after a success", async () => {
    const server = stubServer(LIVE);
    renderToday();
    await flush();
    for (let i = 0; i < 4; i += 1) {
      server.fail("YAHOO_RATE_LIMITED");
    }

    const callsAfter = async (minutes: number) => {
      await advance(minutes * MINUTE);
      return server.teamDayCalls();
    };
    expect(await callsAfter(2)).toBe(2); // limited
    expect(await callsAfter(3)).toBe(2);
    expect(await callsAfter(1)).toBe(3); // 4 min later, limited
    expect(await callsAfter(8)).toBe(4); // 8 min later, limited
    expect(await callsAfter(9)).toBe(4);
    expect(await callsAfter(1)).toBe(5); // 10 min later, limited
    expect(await callsAfter(10)).toBe(6); // still capped at 10, succeeds
    expect(await callsAfter(2)).toBe(7); // back to 2
  });

  it("keeps the interval when Yahoo is unavailable", async () => {
    const server = stubServer(LIVE);
    const teamDay = renderToday();
    await flush();
    server.fail("YAHOO_UNAVAILABLE");

    await advance(2 * MINUTE);
    expect(server.teamDayCalls()).toBe(2);
    expect(teamDay()?.error).toMatchObject({ code: "YAHOO_UNAVAILABLE" });
    expect(teamDay()?.data).toBeDefined();
    await advance(2 * MINUTE);
    expect(server.teamDayCalls()).toBe(3);
    expect(teamDay()?.error).toBeNull();
  });

  it("refetches stale data when the tab regains focus", async () => {
    const server = stubServer({
      kind: "final",
      tipOff: TIP_OFF,
      result: "W",
      ownScore: 1,
      opponentScore: 0,
    });
    renderToday();
    await flush();

    focusManager.setFocused(false);
    await advance(11 * MINUTE);
    expect(server.teamDayCalls()).toBe(1);
    await act(async () => focusManager.setFocused(true));
    await flush();
    expect(server.teamDayCalls()).toBe(2);
  });
});
