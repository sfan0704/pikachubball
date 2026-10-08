/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { meResponseSchema } from "@shared/api/account";
import { leaguesResponseSchema, rosterResponseSchema } from "@shared/api/leagues";
import { teamTableSchema } from "@shared/api/team-table";
import { parseSeasonTable } from "../../../server/fantasy/league-tables";
import { ApiError, isApiError } from "../../../client/src/api/errors";
import {
  getLeagueScope,
  getLeagues,
  getMe,
  savePreferences,
} from "../../../client/src/api/endpoints";
import { useLeagueScope, useLeagues, useMe, useRoster } from "../../../client/src/api/hooks";
import { queryKeys } from "../../../client/src/api/query-keys";
import { jsonResponse } from "../../support/fetch";

const ME = {
  user: { id: "u1", displayName: "Test", email: null },
  yahoo: { connected: true },
  preferences: { selectedLeagueKey: null, selectedTeamKey: null, display: {} },
};
const LEAGUES = {
  leagues: [
    {
      leagueKey: "466.l.1",
      teamKey: "466.l.1.t.1",
      name: "League",
      season: 2025,
      isFinished: false,
      syncedAt: "2026-10-08T01:00:00.000+00:00",
    },
  ],
};
const ROSTER = {
  fetchedAt: "2026-01-15T12:00:00.000Z",
  roster: [{ playerKey: "466.p.1", name: "P", position: "PG", team: "LAL", status: "active" }],
};

function table() {
  const raw = JSON.parse(readFileSync("tests/backend/fixtures/yahoo/league-season.json", "utf8"));
  return parseSeasonTable(raw, "2025-12-11T18:00:00.000Z");
}

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => handler(url, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("API module", () => {
  it("validates a response against the shared schema and sends the session cookie", async () => {
    const fetchMock = stubFetch(() => jsonResponse(ME));

    const me = await getMe();

    expect(meResponseSchema.parse(me)).toEqual(ME);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
  });

  it("sends JSON bodies and builds paths for refresh, scope and encoded keys", async () => {
    const fetchMock = stubFetch((url) =>
      jsonResponse(
        url.startsWith("/api/me/preferences")
          ? ME.preferences
          : url.includes("/season")
            ? table()
            : LEAGUES
      )
    );

    await savePreferences(ME.preferences);
    await getLeagues(true);
    await getLeagueScope("466.l.1", "season");

    const [prefs, leagues, scope] = fetchMock.mock.calls;
    expect(prefs[1]).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ME.preferences),
    });
    expect(leagues[0]).toBe("/api/leagues?refresh=true");
    expect(scope[0]).toBe("/api/leagues/466.l.1/season");
  });

  it("turns a server error into a typed ApiError with its code, request id and retry delay", async () => {
    stubFetch(() =>
      jsonResponse({ code: "YAHOO_RATE_LIMITED", message: "Slow down", requestId: "req-9" }, 429, {
        "Retry-After": "30",
      })
    );

    const error = await getMe().catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "YAHOO_RATE_LIMITED",
      status: 429,
      requestId: "req-9",
      retryAfterSeconds: 30,
    });
    expect(isApiError(error, "YAHOO_RATE_LIMITED", "RATE_LIMITED")).toBe(true);
    expect(isApiError(error, "UNAUTHORIZED")).toBe(false);
  });

  it("reports an unreadable error page, an invalid success body and a network failure", async () => {
    stubFetch(() => new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(getMe()).rejects.toMatchObject({ code: "INTERNAL_ERROR", status: 502 });

    stubFetch(() => jsonResponse({ user: "wrong shape" }));
    await expect(getMe()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(getMe()).rejects.toMatchObject({ code: "NETWORK_ERROR", status: null });
  });

  it("lets an aborted request reject as an abort, not as a network error", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        controller.abort();
        throw init.signal?.reason;
      })
    );

    const error = await getMe(controller.signal).catch((caught) => caught);

    expect(error).not.toBeInstanceOf(ApiError);
  });
});

describe("hooks", () => {
  function wrapper() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it("load the user, leagues, a league scope and a roster, each passing its shared schema", async () => {
    stubFetch((url) =>
      jsonResponse(
        url === "/api/me"
          ? ME
          : url === "/api/leagues"
            ? LEAGUES
            : url.endsWith("/roster")
              ? ROSTER
              : table()
      )
    );

    const me = renderHook(() => useMe(), { wrapper: wrapper() });
    const leagues = renderHook(() => useLeagues(), { wrapper: wrapper() });
    const scope = renderHook(() => useLeagueScope("466.l.100000", "season"), {
      wrapper: wrapper(),
    });
    const roster = renderHook(() => useRoster("466.l.1", "466.l.1.t.1"), { wrapper: wrapper() });

    await waitFor(() => expect(me.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(leagues.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(scope.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(roster.result.current.isSuccess).toBe(true));
    expect(meResponseSchema.parse(me.result.current.data)).toBeTruthy();
    expect(leaguesResponseSchema.parse(leagues.result.current.data)).toBeTruthy();
    expect(teamTableSchema.parse(scope.result.current.data)).toBeTruthy();
    expect(rosterResponseSchema.parse(roster.result.current.data)).toBeTruthy();
  });

  it("wait until the league and scope are chosen, and surface typed errors", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ code: "FORBIDDEN", message: "No", requestId: "r" }, 403)
    );

    const idle = renderHook(() => useLeagueScope(null, null), { wrapper: wrapper() });
    const idleRoster = renderHook(() => useRoster("466.l.1", null), { wrapper: wrapper() });
    expect(idle.result.current.fetchStatus).toBe("idle");
    expect(idleRoster.result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();

    const failing = renderHook(() => useLeagueScope("466.l.9", "current"), { wrapper: wrapper() });
    await waitFor(() => expect(failing.result.current.isError).toBe(true));
    expect(failing.result.current.error).toMatchObject({ code: "FORBIDDEN" });
  });

  it("key each kind of data by its path so a prefix covers what hangs under it", () => {
    expect(queryKeys.leagueScope("466.l.1", 3)).toEqual(["leagues", "466.l.1", "scope", "3"]);
    expect(queryKeys.roster("466.l.1", "466.l.1.t.2").slice(0, 2)).toEqual(
      queryKeys.leagues.concat("466.l.1")
    );
  });
});
