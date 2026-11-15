/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { readFileSync } from "node:fs";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FreshnessProvider } from "../../../client/src/api/freshness";
import { useLeagueScope, useSeasonWeekTables } from "../../../client/src/api/hooks";
import { queryKeys } from "../../../client/src/api/query-keys";
import { parseWeekTable } from "../../../server/fantasy/league-tables";
import { jsonResponse } from "../../support/fetch";

const LEAGUE = "466.l.100000";
const WEEKS = { startWeek: 1, currentWeek: 4 };
const MINUTE = 60_000;

/** The recorded week table, relabelled as `week` (the week in progress for "current"). */
function weekTable(week: number) {
  const raw: unknown = JSON.parse(
    readFileSync("tests/backend/fixtures/yahoo/league-week-1.json", "utf8")
  );
  const table = parseWeekTable(raw, "2025-12-11T18:00:00.000Z");
  return { ...table, scope: { kind: "week", week } };
}

/** A fake server for the week endpoint; scopes listed in `failing` answer 503 until healed. */
function stubServer(failing: Set<string> = new Set()) {
  const fetchMock = vi.fn(async (url: string) => {
    const scope = url.split("/").pop() ?? "";
    if (failing.has(scope)) {
      return jsonResponse({ code: "YAHOO_UNAVAILABLE", message: "down", requestId: "r" }, 503);
    }
    return jsonResponse(weekTable(scope === "current" ? WEEKS.currentWeek : Number(scope)));
  });
  vi.stubGlobal("fetch", fetchMock);
  const callsFor = (scope: string) =>
    fetchMock.mock.calls.filter(([url]) => url === `/api/leagues/${LEAGUE}/${scope}`).length;
  return { fetchMock, callsFor };
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

function freshForOf(client: QueryClient, key: QueryKey) {
  return client.getQueryCache().find({ queryKey: key, exact: true })?.observers[0]?.options
    .staleTime;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useSeasonWeekTables", () => {
  it("loads every week of the season so far once, in week order", async () => {
    const server = stubServer();
    const { wrapper } = setup();

    const { result } = renderHook(() => useSeasonWeekTables(LEAGUE, WEEKS), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((table) => table.scope)).toEqual(
      [1, 2, 3, 4].map((week) => ({ kind: "week", week }))
    );
    expect(result.current.error).toBeNull();
    for (const scope of ["1", "2", "3", "current"]) {
      expect(server.callsFor(scope)).toBe(1);
    }
    expect(server.fetchMock).toHaveBeenCalledTimes(4);
  });

  it("shares the week picker's and Matchup's tables, so a visit asks for each week once", async () => {
    const server = stubServer();
    const { wrapper } = setup();
    const first = renderHook(() => useLeagueScope(LEAGUE, 2), { wrapper });
    const matchup = renderHook(() => useLeagueScope(LEAGUE, "current"), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(matchup.result.current.isSuccess).toBe(true));

    const season = renderHook(() => useSeasonWeekTables(LEAGUE, WEEKS), { wrapper });
    await waitFor(() => expect(season.result.current.data).toHaveLength(4));
    season.rerender();

    expect(server.callsFor("2")).toBe(1);
    expect(server.callsFor("current")).toBe(1);
    expect(server.fetchMock).toHaveBeenCalledTimes(4);
  });

  it("keeps finished weeks Settled and the week in progress on its normal class", async () => {
    stubServer();
    const { client, wrapper } = setup();

    const { result } = renderHook(() => useSeasonWeekTables(LEAGUE, WEEKS), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(freshForOf(client, queryKeys.leagueScope(LEAGUE, 1))).toBe(Infinity);
    expect(freshForOf(client, queryKeys.leagueScope(LEAGUE, 3))).toBe(Infinity);
    expect(freshForOf(client, queryKeys.leagueScope(LEAGUE, "current"))).toBe(10 * MINUTE);
  });

  it("gives no tables when any week fails, and retries only the weeks that failed", async () => {
    const failing = new Set(["2"]);
    const server = stubServer(failing);
    const { wrapper } = setup();

    const { result } = renderHook(() => useSeasonWeekTables(LEAGUE, WEEKS), { wrapper });
    await waitFor(() => expect(result.current.error).toMatchObject({ code: "YAHOO_UNAVAILABLE" }));
    expect(result.current.data).toBeUndefined();
    expect(result.current.dataUpdatedAt).toBe(0);

    failing.clear();
    await result.current.refetch();

    await waitFor(() => expect(result.current.data).toHaveLength(4));
    expect(result.current.error).toBeNull();
    expect(server.callsFor("2")).toBe(2);
    expect(server.callsFor("1")).toBe(1);
  });

  it("waits until the league and its season weeks are known", () => {
    const server = stubServer();
    const { wrapper } = setup();

    const noWeeks = renderHook(() => useSeasonWeekTables(LEAGUE, null), { wrapper });
    const noLeague = renderHook(() => useSeasonWeekTables(null, WEEKS), { wrapper });

    expect(noWeeks.result.current.data).toBeUndefined();
    expect(noWeeks.result.current.error).toBeNull();
    expect(noLeague.result.current.data).toBeUndefined();
    expect(server.fetchMock).not.toHaveBeenCalled();
  });
});
