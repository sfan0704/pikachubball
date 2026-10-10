/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "@shared/api/errors";
import { ApiError, type ApiErrorCode } from "../../../client/src/api/errors";
import { describeError } from "../../../client/src/features/league/error-screens";
import { formatAge } from "../../../client/src/features/league/freshness";
import { useNow } from "../../../client/src/features/league/useNow";
import { LeagueHeader } from "../../../client/src/features/league/LeagueHeader";
import { TableBoundary, type TableQuery } from "../../../client/src/features/league/TableBoundary";
import { ErrorBoundary } from "../../../client/src/components/common/ErrorBoundary";
import { buildLeagueSettings, buildTeamTable } from "../../support/builders";

const NOW = Date.parse("2026-01-15T12:10:00.000Z");

function query(overrides: Partial<TableQuery> = {}): TableQuery {
  return {
    data: undefined,
    error: null,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function show(tableQuery: TableQuery, onPickLeague = vi.fn()) {
  const location = memoryLocation({ path: "/leagues/x", record: true });
  render(
    <Router hook={location.hook}>
      <TableBoundary query={tableQuery} now={NOW} onPickLeague={onPickLeague}>
        {(table) => <p>{table.teams.length} teams shown</p>}
      </TableBoundary>
    </Router>
  );
  return { location, onPickLeague };
}

const API_ERROR = (code: ApiErrorCode) => new ApiError(code, "server words", 500, "req-42");

describe("every state of a table view", () => {
  it("shows a skeleton while loading", () => {
    show(query({ isPending: true }));

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows the table with its age and a refresh button when loaded", async () => {
    const refetch = vi.fn();
    show(query({ data: buildTeamTable([{}, { pts: 600 }]), refetch }));

    expect(screen.getByText("2 teams shown")).toBeInTheDocument();
    expect(screen.getByTestId("text-updated")).toHaveTextContent("Updated 10 min ago");
    await userEvent.click(screen.getByRole("button", { name: "Refresh from Yahoo" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("disables the refresh button while a refresh runs", () => {
    show(query({ data: buildTeamTable([{}]), isFetching: true }));

    expect(screen.getByRole("button", { name: "Refresh from Yahoo" })).toBeDisabled();
  });

  it("says when a league has no stats yet instead of ranking zeros", () => {
    const zero = Object.fromEntries(
      [
        "fgMakes",
        "fgAttempts",
        "ftMakes",
        "ftAttempts",
        "tpm",
        "pts",
        "reb",
        "ast",
        "stl",
        "blk",
        "to",
      ].map((k) => [k, 0])
    );
    show(query({ data: buildTeamTable([zero, zero]) }));

    expect(screen.getByText("No stats yet")).toBeInTheDocument();
    expect(screen.queryByText(/teams shown/)).not.toBeInTheDocument();
  });

  it("explains a league it can't rank", () => {
    const data = buildTeamTable([{}], {
      settings: buildLeagueSettings({ scoringType: "roto" }),
    });
    show(query({ data }));

    expect(screen.getByText("This league isn't supported yet")).toBeInTheDocument();
    expect(screen.getByText(/isn't head-to-head categories/)).toBeInTheDocument();
  });

  it("warns about missing numbers but still shows the table", () => {
    show(query({ data: buildTeamTable([{}, { pts: null }]) }));

    expect(screen.getByText("Some numbers are missing")).toBeInTheDocument();
    expect(screen.getByText("2 teams shown")).toBeInTheDocument();
  });

  it("keeps the data on screen under an error from a failed refresh", () => {
    show(query({ data: buildTeamTable([{}]), error: API_ERROR("YAHOO_UNAVAILABLE") }));

    expect(screen.getByText("Yahoo isn't responding")).toBeInTheDocument();
    expect(screen.getByText("1 teams shown")).toBeInTheDocument();
  });
});

describe("the screen for each error code", () => {
  const expectations: [ApiErrorCode, string, RegExp | null][] = [
    ["YAHOO_RECONNECT_REQUIRED", "Sign in with Yahoo again", /Sign in with Yahoo/],
    ["FORBIDDEN", "That league isn't available", /Choose a league/],
    ["NOT_FOUND", "Not found", /Choose a league/],
    ["VALIDATION_ERROR", "Something went wrong", /Try again/],
    ["RATE_LIMITED", "Too many refreshes", /Try again/],
    ["YAHOO_RATE_LIMITED", "Too many refreshes", /Try again/],
    ["YAHOO_UNAVAILABLE", "Yahoo isn't responding", /Try again/],
    ["INTERNAL_ERROR", "Something went wrong", /Try again/],
    ["CONFLICT", "That changed while you were working", /Try again/],
    ["NETWORK_ERROR", "Can't reach the server", /Try again/],
    ["INVALID_RESPONSE", "Something went wrong", /Try again/],
  ];

  it.each(expectations)("%s", (code, title, action) => {
    show(query({ error: API_ERROR(code) }));

    expect(screen.getByRole("alert")).toHaveTextContent(title);
    expect(screen.getByText("req-42")).toBeInTheDocument();
    if (action) {
      expect(
        screen.getByRole(code === "YAHOO_RECONNECT_REQUIRED" ? "link" : "button", { name: action })
      ).toBeInTheDocument();
    }
  });

  it("covers every code the server can return", () => {
    for (const code of ERROR_CODES) {
      expect(describeError(API_ERROR(code)).code).toBe(code);
    }
  });

  it("sends an unauthorized user to the sign-in page", () => {
    const { location } = show(query({ error: API_ERROR("UNAUTHORIZED") }));

    expect(location.history?.at(-1)).toBe("/auth");
  });

  it("offers the league picker and retry through their callbacks", async () => {
    const refetch = vi.fn();
    const { onPickLeague } = show(query({ error: API_ERROR("FORBIDDEN"), refetch }));
    await userEvent.click(screen.getByRole("button", { name: "Choose a league" }));
    expect(onPickLeague).toHaveBeenCalledOnce();

    show(query({ error: API_ERROR("YAHOO_UNAVAILABLE"), refetch }));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("treats a non-API error as a generic failure without a reference", () => {
    show(query({ error: new Error("boom") }));

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });
});

describe("the freshness label", () => {
  const AT = "2026-01-15T12:00:00.000Z";

  it.each([
    [0, "just now"],
    [59_000, "just now"],
    [5 * 60_000, "5 min ago"],
    [3 * 3_600_000, "3 h ago"],
    [24 * 3_600_000, "1 day ago"],
    [49 * 3_600_000, "2 days ago"],
    [-60_000, "just now"],
  ])("%i ms old reads %s", (age, label) => {
    expect(formatAge(AT, Date.parse(AT) + age)).toBe(label);
  });
});

describe("the header", () => {
  const league = {
    leagueKey: "466.l.1",
    teamKey: "466.l.1.t.3",
    name: "Test League",
    season: 2025,
    isFinished: false,
    syncedAt: "2026-10-08T01:00:00.000+00:00",
  };

  it("always names the season, league and team", () => {
    render(<LeagueHeader league={league} teamName="My Team" />);

    expect(screen.getByRole("heading", { name: "Test League" })).toBeInTheDocument();
    expect(screen.getByText(/2025 season/)).toHaveTextContent("My Team");
  });

  it("falls back to the team key and marks a finished league", () => {
    render(<LeagueHeader league={{ ...league, isFinished: true }} teamName={null} />);

    expect(screen.getByText(/finished/)).toHaveTextContent("466.l.1.t.3");
  });
});

describe("the root error boundary", () => {
  function Boom(): never {
    throw new ApiError("INTERNAL_ERROR", "x", 500, "req-77");
  }

  it("shows a recoverable page with the request id", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    spy.mockRestore();

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("req-77")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try Again/ })).toBeInTheDocument();
  });
});

describe("useNow", () => {
  it("moves forward every minute", () => {
    vi.useFakeTimers({ now: Date.parse("2026-01-15T12:00:00.000Z") });
    const { result } = renderHook(() => useNow());
    const first = result.current;

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current - first).toBe(60_000);
    vi.useRealTimers();
  });
});
