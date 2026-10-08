/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { readFileSync } from "node:fs";
import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rankings } from "@shared/domain";
import { parseSeasonTable, parseWeekTable } from "../../../server/fantasy/league-tables";
import { useLeagueScope } from "../../../client/src/api/hooks";
import { queryClient } from "../../../client/src/lib/queryClient";
import { HeatmapView } from "../../../client/src/features/league/HeatmapView";
import { RankingsView } from "../../../client/src/features/league/RankingsView";
import { buildRankingsRows } from "../../../client/src/features/league/rankings-model";
import { buildTeamTable } from "../../support/builders";
import { jsonResponse } from "../../support/fetch";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`tests/backend/fixtures/yahoo/${name}.json`, "utf8"));
}

const SEASON = parseSeasonTable(fixture("league-season"), "2025-12-11T18:00:00.000Z");
const WEEK_1 = parseWeekTable(fixture("league-week-1"), "2025-12-11T18:00:00.000Z", 1);
const MINE = "466.l.100000.t.11";

afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe("RankingsView", () => {
  it("lists every team in category-rank-sum order, matching the domain ranking", () => {
    render(<RankingsView table={SEASON} myTeamKey={MINE} />);

    const expected = rankings(SEASON).map((team) => team.teamKey);
    const shown = screen
      .getAllByTestId(/^row-ranking-/)
      .map((row) => row.getAttribute("data-testid")!.replace("row-ranking-", ""));
    expect(shown).toEqual(expected);
    expect(shown).toHaveLength(14);
  });

  it("labels the overall column as a rank sum where lower is better", () => {
    render(<RankingsView table={SEASON} myTeamKey={MINE} />);

    expect(
      screen.getByRole("button", { name: /Category rank sum — lower is better/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/not Yahoo's official standings/)).toBeInTheDocument();
  });

  it("marks the user's team with text, not only colour", () => {
    render(<RankingsView table={SEASON} myTeamKey={MINE} />);

    const row = screen.getByTestId(`row-ranking-${MINE}`);
    expect(within(row).getByText("(you)")).toBeInTheDocument();
    expect(screen.getAllByText("(you)")).toHaveLength(1);
  });

  it("switches to totals, showing makes and attempts for the percentages", async () => {
    render(<RankingsView table={SEASON} myTeamKey={MINE} />);

    await userEvent.click(screen.getByRole("switch"));

    const row = screen.getByTestId(`row-ranking-${MINE}`);
    expect(within(row).getByText("1713/3579 (47.9%)")).toBeInTheDocument();
    expect(within(row).getByText("4763")).toBeInTheDocument();
  });

  it("sorts by a category and flips direction on a second click", async () => {
    render(<RankingsView table={SEASON} myTeamKey={MINE} />);
    const order = () =>
      screen.getAllByTestId(/^row-ranking-/).map((row) => row.getAttribute("data-testid"));

    await userEvent.click(screen.getByTestId("sort-pts"));
    const best = order();
    await userEvent.click(screen.getByTestId("sort-pts"));

    expect(order()).toEqual([...best].reverse());
    expect(screen.getByTestId("sort-pts").closest("th")).toHaveAttribute("aria-sort", "descending");
  });

  it("shows unavailable values as a dash and sorts them last", () => {
    const table = buildTeamTable([{ pts: null }, { pts: 500 }, { pts: 600 }]);

    const rows = buildRankingsRows(table, "466.l.1.t.1", "totals", {
      key: "pts",
      direction: "desc",
    });

    expect(rows.map((row) => row.teamKey)).toEqual(["466.l.1.t.3", "466.l.1.t.2", "466.l.1.t.1"]);
    expect(rows[2].cells.find((cell) => cell.key === "pts")?.text).toBe("—");
    const ascending = buildRankingsRows(table, "466.l.1.t.1", "totals", {
      key: "pts",
      direction: "asc",
    });
    expect(ascending.at(-1)?.teamKey).toBe("466.l.1.t.1");
  });

  it("renders a weekly table the same way", () => {
    render(<RankingsView table={WEEK_1} myTeamKey={MINE} />);

    expect(screen.getAllByTestId(/^row-ranking-/)).toHaveLength(14);
  });
});

describe("HeatmapView", () => {
  it("shows each team's total and rank in every category, with the user's team marked", () => {
    render(<HeatmapView table={SEASON} myTeamKey={MINE} />);

    const row = screen.getByTestId(`row-heatmap-${MINE}`);
    expect(within(row).getByText("(you)")).toBeInTheDocument();
    expect(within(row).getByText("4763")).toBeInTheDocument();
    expect(within(row).getAllByText(/^\(\d+\)$/)).toHaveLength(9);
    expect(screen.getAllByTestId(/^row-heatmap-/)).toHaveLength(14);
  });
});

describe("switching scope", () => {
  it("makes no new request when going back to a scope that is already loaded", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      jsonResponse(url.endsWith("/season") ? SEASON : WEEK_1)
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const season = renderHook(({ scope }) => useLeagueScope("466.l.100000", scope), {
      wrapper,
      initialProps: { scope: "season" as "season" | 1 },
    });
    await waitFor(() => expect(season.result.current.isSuccess).toBe(true));
    season.rerender({ scope: 1 });
    await waitFor(() =>
      expect(season.result.current.data?.scope).toEqual({ kind: "week", week: 1 })
    );
    season.rerender({ scope: "season" });
    await waitFor(() => expect(season.result.current.data?.scope).toEqual({ kind: "season" }));
    season.rerender({ scope: 1 });
    await waitFor(() =>
      expect(season.result.current.data?.scope).toEqual({ kind: "week", week: 1 })
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
