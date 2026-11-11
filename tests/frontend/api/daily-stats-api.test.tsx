/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FreshnessProvider } from "../../../client/src/api/freshness";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DailyStatsSource } from "../../../server/fantasy/daily-stats-source";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
import {
  useDraft,
  useGameLogs,
  usePlayerList,
  usePlayerStats,
  useSchedule,
  useTeamDay,
  useTeamDays,
  useTransactions,
  useWeeks,
} from "../../../client/src/api/daily-stats-hooks";
import { queryKeys } from "../../../client/src/api/query-keys";
import { fixedClock } from "../../support/clock";
import { jsonResponse } from "../../support/fetch";

const LEAGUE = "466.l.100000";
const TEAM = `${LEAGUE}.t.11`;
const AT = "2026-11-11T20:00:00.000Z";
const source: DailyStatsSource = new FixtureDailyStatsSource(fixedClock(AT));

/** What the server answers for each dataset path, from the fixture source. */
async function answer(url: string): Promise<object> {
  const { pathname, searchParams } = new URL(url, "http://app.test");
  const path = decodeURIComponent(pathname).replace(`/api/leagues/${LEAGUE}`, "");
  const players = searchParams.get("players")?.split(",") ?? [];
  const routes: Record<string, () => Promise<object>> = {
    [`/teams/${TEAM}/days/2026-11-10`]: () => source.getTeamDay(LEAGUE, TEAM, "2026-11-10"),
    [`/teams/${TEAM}/days/2026-11-11`]: () => source.getTeamDay(LEAGUE, TEAM, "2026-11-11"),
    "/games": () => source.getGameLogs(LEAGUE, players),
    "/player-stats/last30": () => source.getPlayerStats(LEAGUE, "last30", players),
    "/players": () =>
      source.listPlayers(LEAGUE, {
        status: "owned",
        sort: "overallRank",
        start: 25,
        position: "C",
      }),
    "/schedule": () => source.getSchedule(LEAGUE),
    [`/teams/${TEAM}/transactions`]: () => source.getTransactions(LEAGUE, TEAM),
    "/draft": () => source.getDraft(LEAGUE),
    "/weeks": () => source.getWeeks(LEAGUE),
  };
  return { ...(await routes[path]()), fetchedAt: AT };
}

function stubServer() {
  const fetchMock = vi.fn(async (url: string) => jsonResponse(await answer(url)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <FreshnessProvider>{children}</FreshnessProvider>
    </QueryClientProvider>
  );
}

afterEach(() => vi.unstubAllGlobals());

const PLAYERS = ["466.p.11102", "466.p.11101"];

/** What these tests read from any hook's result. */
type AnyQuery = () => { isSuccess: boolean; data: unknown; fetchStatus: string };

describe("daily-stats hooks", () => {
  it("load every dataset from its endpoint, each passing its shared schema", async () => {
    const fetchMock = stubServer();
    const hooks: AnyQuery[] = [
      () => useTeamDay(LEAGUE, TEAM, "2026-11-11"),
      () => useGameLogs(LEAGUE, PLAYERS),
      () => usePlayerStats(LEAGUE, "last30", PLAYERS),
      () =>
        usePlayerList(LEAGUE, { status: "owned", sort: "overallRank", start: 25, position: "C" }),
      () => useSchedule(LEAGUE),
      () => useTransactions(LEAGUE, TEAM),
      () => useDraft(LEAGUE),
      () => useWeeks(LEAGUE),
    ];

    const results = hooks.map((hook) => renderHook(hook, { wrapper: wrapper() }).result);

    for (const result of results) {
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toMatchObject({ fetchedAt: AT });
    }
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `/api/leagues/${LEAGUE}/teams/${TEAM}/days/2026-11-11`,
      `/api/leagues/${LEAGUE}/games?players=466.p.11101%2C466.p.11102`,
      `/api/leagues/${LEAGUE}/player-stats/last30?players=466.p.11101%2C466.p.11102`,
      `/api/leagues/${LEAGUE}/players?status=owned&sort=overallRank&start=25&position=C`,
      `/api/leagues/${LEAGUE}/schedule`,
      `/api/leagues/${LEAGUE}/teams/${TEAM}/transactions`,
      `/api/leagues/${LEAGUE}/draft`,
      `/api/leagues/${LEAGUE}/weeks`,
    ]);
  });

  it("keep a team's loaded days when one date fails, under that date's error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/days/2026-11-09")
          ? jsonResponse({ code: "YAHOO_UNAVAILABLE", message: "x", requestId: "r" }, 503)
          : jsonResponse(await answer(url))
      )
    );
    const dates = ["2026-11-09", "2026-11-10", "2026-11-11"];
    const { result } = renderHook(() => useTeamDays(LEAGUE, TEAM, dates), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((day) => day.date)).toEqual(["2026-11-10", "2026-11-11"]);
    expect(result.current.error).not.toBeNull();
  });

  it("give no days when every date fails, so the section shows only the error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ code: "YAHOO_UNAVAILABLE", message: "x", requestId: "r" }, 503)
      )
    );
    const { result } = renderHook(() => useTeamDays(LEAGUE, TEAM, ["2026-11-10", "2026-11-11"]), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toBeUndefined();
  });

  it("wait until their inputs are chosen", () => {
    const fetchMock = stubServer();
    const idle: AnyQuery[] = [
      () => useTeamDay(LEAGUE, TEAM, null),
      () => useGameLogs(LEAGUE, []),
      () => usePlayerStats(null, "season", PLAYERS),
      () => usePlayerList(null, { status: "available", sort: "actualRank", start: 0 }),
      () => useSchedule(null),
      () => useTransactions(LEAGUE, null),
      () => useDraft(null),
      () => useWeeks(null),
    ];

    for (const hook of idle) {
      expect(renderHook(hook, { wrapper: wrapper() }).result.current.fetchStatus).toBe("idle");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("key each dataset under its league and team, the same players in any order alike", () => {
    expect(queryKeys.teamDay(LEAGUE, TEAM, "2026-11-11")).toEqual([
      "leagues",
      LEAGUE,
      "teams",
      TEAM,
      "days",
      "2026-11-11",
    ]);
    expect(queryKeys.gameLogs(LEAGUE, ["b", "a"])).toEqual(queryKeys.gameLogs(LEAGUE, ["a", "b"]));
    expect(queryKeys.playerStats(LEAGUE, "season", ["a"])).not.toEqual(
      queryKeys.playerStats(LEAGUE, "last7", ["a"])
    );
    expect(queryKeys.players(LEAGUE, { status: "waivers", sort: "actualRank", start: 0 })).toEqual([
      "leagues",
      LEAGUE,
      "players",
      "waivers",
      "actualRank",
      "",
      "",
      0,
    ]);
    expect(queryKeys.transactions(LEAGUE, TEAM).slice(0, 4)).toEqual([
      "leagues",
      LEAGUE,
      "teams",
      TEAM,
    ]);
    expect(queryKeys.weeks(LEAGUE)).toEqual(["leagues", LEAGUE, "weeks"]);
  });
});
