/**
 * @vitest-environment happy-dom
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { NbaGame } from "@shared/api/daily-stats-values";
import { compareTotals, measured, missingLine } from "@shared/domain";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
import { boardState, FreshnessLine } from "../../../client/src/features/daily-stats/FreshnessLine";
import {
  averageText,
  cardMeta,
  entryText,
  gameStateText,
  percentText,
  playerCards,
  shortName,
} from "../../../client/src/features/daily-stats/matchup-board";
import {
  PlayerColumns,
  PlayerColumnView,
  type PlayerColumn,
} from "../../../client/src/features/daily-stats/PlayerColumns";
import { TotalsGrid } from "../../../client/src/features/daily-stats/TotalsGrid";
import { buildStatLine, buildTeamTotals } from "../../support/builders";
import { fixedClock } from "../../support/clock";

const LEAGUE = "466.l.100000";
const TEAM = `${LEAGUE}.t.11`;
const TODAY = "2026-11-11";
const AT = "2026-11-11T20:00:00.000Z";
const source = new FixtureDailyStatsSource(fixedClock(AT));

async function todaysCards(teamKey = TEAM) {
  const day = { ...(await source.getTeamDay(LEAGUE, teamKey, TODAY)), fetchedAt: AT };
  const keys = day.players.map(({ player }) => player.playerKey);
  const logs = { ...(await source.getGameLogs(LEAGUE, keys)), fetchedAt: AT };
  const season = { ...(await source.getPlayerStats(LEAGUE, "season", keys)), fetchedAt: AT };
  return playerCards(day, logs, season);
}

/** The two columns as the Matchup board lays them out. */
function Board({
  columns,
  ...rest
}: {
  columns: readonly PlayerColumn[];
  category: "pts";
  isToday: boolean;
}) {
  return (
    <PlayerColumns>
      {columns.map((column) => (
        <PlayerColumnView
          key={column.teamKey}
          column={column}
          onOpenPlayer={() => undefined}
          {...rest}
        />
      ))}
    </PlayerColumns>
  );
}

const game = (state: NbaGame["state"]): NbaGame => ({
  gameId: "g",
  date: TODAY,
  opponent: "NYK",
  isHome: true,
  state,
});

describe("Matchup board text", () => {
  it("shows percentages as box scores do and keeps 0/0 and measured zeros", () => {
    expect(percentText(0.4821)).toBe(".482");
    expect(percentText(null)).toBe("–");
    const shots = { kind: "value", value: null, shots: { makes: 0, attempts: 0 } } as const;
    expect(entryText(shots, false)).toBe("0/0");
    expect(entryText({ kind: "value", value: 0, shots: null }, false)).toBe("0");
  });

  it("tells every missing value apart", () => {
    expect(entryText({ kind: "notYetPlayed" }, false)).toBe("–");
    expect(entryText({ kind: "unavailable" }, false)).toBe("n/a");
    expect(entryText({ kind: "noGame" }, false)).toBe("No game");
    expect(entryText({ kind: "didNotPlay" }, false)).toBe("DNP");
    expect(entryText({ kind: "notYetPlayed" }, true)).toBe("Out");
  });

  it("states each game: tip-off in Eastern time, quarter and clock, overtime, text and final", () => {
    const tipOff = "2026-11-11T23:30:00.000Z";
    expect(gameStateText({ kind: "scheduled", tipOff })).toBe("6:30 PM ET");
    const clock = { kind: "clock", clock: "7:48", ownScore: 1, opponentScore: 2 } as const;
    expect(gameStateText({ kind: "live", tipOff, progress: { ...clock, period: 3 } })).toBe(
      "Q3 7:48"
    );
    expect(gameStateText({ kind: "live", tipOff, progress: { ...clock, period: 5 } })).toBe(
      "OT 7:48"
    );
    expect(gameStateText({ kind: "live", tipOff, progress: { ...clock, period: 6 } })).toBe(
      "2OT 7:48"
    );
    expect(
      gameStateText({ kind: "live", tipOff, progress: { kind: "text", text: "Halftime" } })
    ).toBe("Halftime");
    expect(
      gameStateText({ kind: "final", tipOff, result: "L", ownScore: 99, opponentScore: 101 })
    ).toBe("L 99–101");
  });

  it("adds makes/attempts to shooting averages and says when the average is unknown", () => {
    const shots = { kind: "value", value: 0.5, shots: { makes: 5, attempts: 10 } } as const;
    const average = { fgPct: 0.45, pts: 12.34 } as never;
    expect(averageText("fgPct", shots, average)).toBe("5/10 · avg .450");
    expect(averageText("pts", { kind: "noGame" }, average)).toBe("avg 12.3");
    expect(averageText("pts", { kind: "noGame" }, null)).toBe("avg –");
  });

  it("shortens names and leaves the game out of the meta while it is unknown", async () => {
    expect(shortName("Avery Knoll Jr.")).toBe("A. Knoll Jr.");
    expect(shortName("Cher")).toBe("Cher");
    const [first] = await todaysCards();
    expect(cardMeta({ ...first, game: undefined })).toBe(first.slot);
    expect(cardMeta({ ...first, game: null })).toBe(first.slot);
  });
});

describe("boardState", () => {
  const tipOff = "2026-11-11T23:30:00.000Z";
  const live = game({
    kind: "live",
    tipOff,
    progress: { kind: "text", text: "Halftime" },
  });
  const final = game({ kind: "final", tipOff, result: "W", ownScore: 2, opponentScore: 1 });
  const scheduled = game({ kind: "scheduled", tipOff });

  it("is delayed after a failed refresh, live while a game is on, final once all have ended", () => {
    expect(boardState([live], true)).toBe("delayed");
    expect(boardState([final, live, null], false)).toBe("live");
    expect(boardState([final, null], false)).toBe("final");
    expect(boardState([final, scheduled], false)).toBe("updated");
    expect(boardState([final, undefined], false)).toBe("updated");
  });

  it("puts the board state in front of the shared age label, and says when a refresh failed", () => {
    const now = Date.parse(AT);
    const source = { data: {}, dataUpdatedAt: now - 3 * 60_000, error: null };
    const { rerender } = render(<FreshnessLine sources={[source]} games={[live]} now={now} />);
    expect(screen.getByTestId("freshness")).toHaveTextContent("Live · Updated 3 min ago");
    rerender(
      <FreshnessLine sources={[{ ...source, error: new Error("x") }]} games={[live]} now={now} />
    );
    expect(screen.getByTestId("freshness")).toHaveAttribute("data-state", "delayed");
    rerender(<FreshnessLine sources={[]} games={[]} now={now} />);
    expect(screen.queryByTestId("freshness")).not.toBeInTheDocument();
  });
});

describe("PlayerColumns", () => {
  it("sorts each column on its own, sets bench and IL apart, and marks every game state", async () => {
    const [mine, theirs] = [await todaysCards(), await todaysCards(`${LEAGUE}.t.8`)];
    render(
      <Board
        category="pts"
        isToday
        columns={[
          { teamKey: TEAM, label: "Team 11", rows: mine },
          { teamKey: `${LEAGUE}.t.8`, label: "Team 8", rows: theirs },
        ]}
      />
    );
    const column = within(screen.getByTestId(`column-${TEAM}`));
    const values = column
      .getAllByTestId("card-value")
      .map((cell) => cell.textContent ?? "")
      .slice(0, 10);
    const points = values.filter((value) => /^\d+$/.test(value)).map(Number);
    expect(points).toEqual([...points].sort((a, b) => b - a));
    expect(values.slice(points.length)).toEqual(["n/a", "–", "–", "No game", "No game", "DNP"]);
    expect(within(column.getByTestId("bench-players")).getAllByRole("listitem")).toHaveLength(3);
    expect(column.getByText("Out")).toBeInTheDocument();
    expect(column.getAllByText(/Q3 7:48/).length).toBeGreaterThan(0);
    expect(column.getAllByText(/6:30 PM ET/).length).toBeGreaterThan(0);
    expect(column.getAllByText(/W 110–104|L 104–110/).length).toBeGreaterThan(0);
  });

  it("hides injury tags and Out on a past date", async () => {
    const cards = await todaysCards();
    render(
      <Board
        category="pts"
        isToday={false}
        columns={[
          { teamKey: TEAM, label: "Team 11", rows: cards },
          { teamKey: "other", label: "Team 8", rows: [] },
        ]}
      />
    );
    expect(screen.queryByText("GTD")).not.toBeInTheDocument();
    expect(screen.queryByText("Out")).not.toBeInTheDocument();
  });

  it("colours a value against the average, but never a live game red", async () => {
    const [card] = await todaysCards();
    const average = { pts: 30 } as never;
    const liveGame = game({
      kind: "live",
      tipOff: AT,
      progress: { kind: "text", text: "Halftime" },
    });
    const row = { ...card, line: buildStatLine({ pts: measured(5) }), average };
    const notPlayed = { ...card, line: missingLine("noGame"), average, isStartingSlot: false };
    render(
      <Board
        category="pts"
        isToday
        columns={[
          {
            teamKey: "a",
            label: "Final",
            rows: [
              {
                ...row,
                game: {
                  ...liveGame,
                  state: { kind: "final", tipOff: AT, result: "W", ownScore: 1, opponentScore: 0 },
                },
              },
            ],
          },
          { teamKey: "b", label: "Live", rows: [{ ...row, game: liveGame }, notPlayed] },
        ]}
      />
    );
    const callout = (team: string) =>
      within(screen.getByTestId(`column-${team}`)).getAllByTestId("card-value")[0].dataset.callout;
    expect(callout("a")).toBe("worse");
    expect(callout("b")).toBe("usual");
  });
});

describe("TotalsGrid", () => {
  it("tints each category by result, outlines the selected one and picks on tap", async () => {
    const mine = buildTeamTotals({ pts: 400, to: 20 });
    const theirs = buildTeamTotals({ pts: 380, to: 25 });
    const comparison = compareTotals(mine, theirs);
    const onSelect = vi.fn();
    render(
      <TotalsGrid
        mine={{ label: "Team 11", totals: mine }}
        theirs={{ label: "Team 8", totals: theirs }}
        comparison={comparison}
        selected="pts"
        onSelect={onSelect}
      />
    );
    expect(screen.getByTestId("grid-category-pts")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("grid-category-pts")).toHaveAttribute("data-result", "win");
    expect(screen.getByTestId("grid-category-to")).toHaveAttribute("data-result", "win");
    expect(screen.getByTestId("grid-category-reb")).toHaveAttribute("data-result", "tie");
    await userEvent.click(screen.getByTestId("grid-category-reb"));
    expect(onSelect).toHaveBeenCalledWith("reb");
  });

  it("shows percentages only and an unknown total as a dash", () => {
    const mine = buildTeamTotals({ fgMakes: 241, fgAttempts: 500, pts: null });
    const comparison = compareTotals(mine, buildTeamTotals());
    render(
      <TotalsGrid
        mine={{ label: "Team 11", totals: mine }}
        theirs={{ label: "Team 8", totals: buildTeamTotals() }}
        comparison={comparison}
        selected="fgPct"
        onSelect={() => undefined}
      />
    );
    const grid = screen.getByTestId("totals-grid");
    expect(grid).toHaveTextContent(".482");
    expect(grid).not.toHaveTextContent("241/500");
    expect(screen.getByTestId("grid-category-pts")).toHaveAttribute("data-result", "unavailable");
  });
});
