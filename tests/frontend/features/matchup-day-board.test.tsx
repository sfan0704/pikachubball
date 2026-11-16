/**
 * @vitest-environment happy-dom
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { NbaGame } from "@shared/api/daily-stats-values";
import { categoryEntry, compareCategories, missingLine, type LeagueCategory } from "@shared/domain";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
import { YahooDailyStatsSource } from "../../../server/fantasy/yahoo-daily-stats-source";
import { DailyStatsRequests } from "../../../server/fantasy/yahoo/daily-stats-requests";
import { boardState, FreshnessLine } from "../../../client/src/features/daily-stats/FreshnessLine";
import {
  averageText,
  cardMeta,
  entryText,
  gameStateText,
  boardValueText,
  orderHint,
  playerCards,
  rosterEntry,
  shortName,
} from "../../../client/src/features/daily-stats/matchup-board";
import {
  PlayerColumns,
  PlayerColumnView,
  type PlayerColumn,
} from "../../../client/src/features/daily-stats/PlayerColumns";
import { TotalsGrid } from "../../../client/src/features/daily-stats/TotalsGrid";
import {
  buildCategoryValues,
  buildStatLine,
  CATEGORY,
  STANDARD_CATEGORIES,
  TEN_CATEGORIES,
} from "../../support/builders";
import { fixedClock } from "../../support/clock";
import { silentLogger } from "../../support/dependencies";
import { replayYahoo } from "../../support/yahoo-recordings";

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
  return playerCards(day, logs, season, STANDARD_CATEGORIES);
}

/** The two columns as the Matchup board lays them out. */
function Board({
  columns,
  ...rest
}: {
  columns: readonly PlayerColumn[];
  category: LeagueCategory | null;
  isToday: boolean;
  pickedKey?: string;
}) {
  return (
    <PlayerColumns>
      {columns.map((column) => (
        <PlayerColumnView
          key={column.teamKey}
          column={column}
          onOpenPlayer={() => undefined}
          pickedKey={null}
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
  it("shows percentages as box scores do, other ratios to two places, and keeps 0/0 and measured zeros", () => {
    expect(boardValueText(CATEGORY.fgPct, 0.4821)).toBe(".482");
    expect(boardValueText(CATEGORY.astTo, 2.1666)).toBe("2.17");
    expect(boardValueText(CATEGORY.pts, 31)).toBe("31");
    expect(boardValueText(CATEGORY.fgPct, null)).toBe("–");
    const shots = { kind: "value", value: null, parts: { top: 0, bottom: 0 } } as const;
    expect(entryText(CATEGORY.ftPct, shots, false)).toBe("0/0");
    expect(entryText(CATEGORY.blk, { kind: "value", value: 0, parts: null }, false)).toBe("0");
    expect(entryText(CATEGORY.tpPct, { kind: "value", value: 0.4, parts: null }, false)).toBe(
      ".400"
    );
  });

  it("tells every missing value apart", () => {
    const pts = CATEGORY.pts;
    expect(entryText(pts, { kind: "notYetPlayed" }, false)).toBe("–");
    expect(entryText(pts, { kind: "unavailable" }, false)).toBe("n/a");
    expect(entryText(pts, { kind: "noGame" }, false)).toBe("No game");
    expect(entryText(pts, { kind: "didNotPlay" }, false)).toBe("DNP");
    expect(entryText(pts, { kind: "notYetPlayed" }, true)).toBe("Out");
    expect(entryText(null, { kind: "value", value: 12, parts: null }, false)).toBe("—");
  });

  it("tells who played while the categories are unknown, without a value", () => {
    expect(rosterEntry(buildStatLine())).toEqual({ kind: "unavailable" });
    expect(rosterEntry(missingLine("didNotPlay"))).toEqual({ kind: "didNotPlay" });
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
    const shots = { kind: "value", value: 0.5, parts: { top: 5, bottom: 10 } } as const;
    const average = { "5": 0.45, "12": 12.34, "20": 2.5 };
    expect(averageText(CATEGORY.fgPct, shots, average)).toBe("5/10 · avg .450");
    expect(averageText(CATEGORY.pts, { kind: "noGame" }, average)).toBe("avg 12.3");
    expect(averageText(CATEGORY.astTo, { kind: "noGame" }, average)).toBe("avg 2.50");
    expect(averageText(CATEGORY.pts, { kind: "noGame" }, null)).toBe("avg –");
  });

  it("says how each column is sorted: most first, fewest turnovers and fouls, most attempts", () => {
    expect(orderHint(CATEGORY.pts)).toBe("most first");
    expect(orderHint(CATEGORY.to)).toBe("fewest first");
    expect(orderHint(CATEGORY.pf)).toBe("fewest first");
    expect(orderHint(CATEGORY.fgPct)).toBe("most attempts first");
    expect(orderHint(CATEGORY.tpPct)).toBe("most attempts first");
    expect(orderHint(CATEGORY.astTo)).toBe("most first");
  });

  it("shortens names and leaves the game out of the meta while it is unknown", async () => {
    expect(shortName("Avery Knoll Jr.")).toBe("A. Knoll Jr.");
    expect(shortName("Cher")).toBe("Cher");
    const [first] = await todaysCards();
    expect(cardMeta({ ...first, game: undefined })).toBe(first.slot);
    expect(cardMeta({ ...first, game: null })).toBe(first.slot);
  });
});

describe("Matchup cards before tip-off", () => {
  // FAN-92's capture of a team day on 2026-11-07 before any game: Yahoo sent "-" for every stat.
  const PRE_GAME_TEAM = "478.l.100000.t.10";
  const PRE_GAME_DATE = "2026-11-07";
  const PRE_GAME_AT = "2026-11-07T17:00:00.000Z";

  async function preGameDay() {
    const path = `/team/${PRE_GAME_TEAM}/roster;date=${PRE_GAME_DATE}/players/stats;type=date;date=${PRE_GAME_DATE}`;
    const yahoo = replayYahoo({ [path]: "daily-stats/d2-team-day-before-tip-off" });
    const requests = new DailyStatsRequests(
      async () => yahoo,
      silentLogger,
      fixedClock(PRE_GAME_AT)
    );
    const day = await new YahooDailyStatsSource(requests).getTeamDay(
      "478.l.100000",
      PRE_GAME_TEAM,
      PRE_GAME_DATE
    );
    return { ...day, fetchedAt: PRE_GAME_AT };
  }

  /** Game logs where every player's team plays that date, except the given players' teams. */
  function logsWith(
    day: Awaited<ReturnType<typeof preGameDay>>,
    state: NbaGame["state"],
    withoutGame: ReadonlySet<string> = new Set()
  ) {
    return {
      fetchedAt: PRE_GAME_AT,
      players: day.players.map(({ player }) => ({
        playerKey: player.playerKey,
        nbaTeam: player.nbaTeam,
        games: withoutGame.has(player.playerKey)
          ? []
          : [
              {
                ...game(state),
                date: PRE_GAME_DATE,
                minutes: { kind: "notYetPlayed" as const },
                line: missingLine("notYetPlayed"),
              },
            ],
      })),
    };
  }

  const pts = (cards: ReturnType<typeof playerCards>) =>
    cards.map((card) => entryText(CATEGORY.pts, categoryEntry(card.line, CATEGORY.pts), false));

  it("shows a game still to come as –, not No game, while Yahoo sends - before tip-off", async () => {
    const day = await preGameDay();
    expect(day.players.length).toBeGreaterThan(0);
    const scheduled = { kind: "scheduled", tipOff: "2026-11-08T00:00:00.000Z" } as const;
    expect(pts(playerCards(day, logsWith(day, scheduled), undefined, STANDARD_CATEGORIES))).toEqual(
      day.players.map(() => "–")
    );
  });

  it("keeps No game for a player whose team has no game that date", async () => {
    const day = await preGameDay();
    const [idle] = day.players;
    const scheduled = { kind: "scheduled", tipOff: "2026-11-08T00:00:00.000Z" } as const;
    const cards = playerCards(
      day,
      logsWith(day, scheduled, new Set([idle.player.playerKey])),
      undefined,
      STANDARD_CATEGORIES
    );
    expect(pts(cards)[0]).toBe("No game");
    expect(pts(cards).slice(1)).toEqual(cards.slice(1).map(() => "–"));
  });

  it("keeps Yahoo's line while game logs are still loading", async () => {
    const day = await preGameDay();
    expect(pts(playerCards(day, undefined, undefined, STANDARD_CATEGORIES))).toEqual(
      day.players.map(() => "No game")
    );
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
        category={CATEGORY.pts}
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

  it("still lists both rosters, with who played, while the league's categories are unknown", async () => {
    const cards = await todaysCards();
    render(
      <Board category={null} isToday columns={[{ teamKey: TEAM, label: "Team 11", rows: cards }]} />
    );
    const values = within(screen.getByTestId(`column-${TEAM}`))
      .getAllByTestId("card-value")
      .map((cell) => cell.textContent);
    expect(values).toHaveLength(cards.length);
    expect(values).toContain("n/a");
    expect(values).toContain("No game");
    expect(values).not.toContain("—");
    expect(values.every((value) => !/^\d/.test(value ?? ""))).toBe(true);
  });

  it("marks the player the details panel shows as current, and no one else", async () => {
    const cards = await todaysCards();
    const picked = cards[1].player;
    render(
      <Board
        category={CATEGORY.pts}
        isToday
        pickedKey={picked.playerKey}
        columns={[{ teamKey: TEAM, label: "Team 11", rows: cards }]}
      />
    );
    const current = screen
      .getAllByRole("button", { name: /open player detail/ })
      .filter((button) => button.getAttribute("aria-current") === "true");
    expect(current).toEqual([
      screen.getByRole("button", { name: `${picked.name}: open player detail` }),
    ]);
    expect(screen.getByTestId(`player-card-${picked.playerKey}`)).toHaveClass("border-2");
  });

  it("hides injury tags and Out on a past date", async () => {
    const cards = await todaysCards();
    render(
      <Board
        category={CATEGORY.pts}
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
    const average = { "12": 30 };
    const liveGame = game({
      kind: "live",
      tipOff: AT,
      progress: { kind: "text", text: "Halftime" },
    });
    const row = { ...card, line: buildStatLine({ pts: 5 }), average };
    const notPlayed = { ...card, line: missingLine("noGame"), average, isStartingSlot: false };
    render(
      <Board
        category={CATEGORY.pts}
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
  const compare = (mine: ReturnType<typeof buildCategoryValues>, theirs: typeof mine) =>
    compareCategories(STANDARD_CATEGORIES, mine, theirs);

  it("tints each category by result, outlines the selected one and picks on tap", async () => {
    const mine = buildCategoryValues({ pts: 400, to: 20 });
    const theirs = buildCategoryValues({ pts: 380, to: 25 });
    const onSelect = vi.fn();
    render(
      <TotalsGrid
        mine={{ label: "Team 11", values: mine }}
        theirs={{ label: "Team 8", values: theirs }}
        comparison={compare(mine, theirs)}
        selected="12"
        onSelect={onSelect}
      />
    );
    expect(screen.getByTestId("grid-category-12")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("grid-category-12")).toHaveAttribute("data-result", "win");
    expect(screen.getByTestId("grid-category-19")).toHaveAttribute("data-result", "win");
    expect(screen.getByTestId("grid-category-15")).toHaveAttribute("data-result", "tie");
    expect(screen.getByRole("button", { name: "3PM, tied" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "STL, tied" })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("grid-category-15"));
    expect(onSelect).toHaveBeenCalledWith("15");
  });

  it("shows percentages only and an unknown total as a dash", () => {
    const mine = buildCategoryValues({ fgm: 241, fga: 500, pts: null });
    render(
      <TotalsGrid
        mine={{ label: "Team 11", values: mine }}
        theirs={{ label: "Team 8", values: buildCategoryValues() }}
        comparison={compare(mine, buildCategoryValues())}
        selected="5"
        onSelect={() => undefined}
      />
    );
    const grid = screen.getByTestId("totals-grid");
    expect(grid).toHaveTextContent(".482");
    expect(grid).not.toHaveTextContent("241/500");
    expect(screen.getByTestId("grid-category-12")).toHaveAttribute("data-result", "unavailable");
  });

  it("lays nine categories in one row and ten or twelve in equal rows", () => {
    const rows = (categories: typeof STANDARD_CATEGORIES) => {
      const values = buildCategoryValues({}, categories);
      const { container, unmount } = render(
        <TotalsGrid
          mine={{ label: "Team 11", values }}
          theirs={{ label: "Team 8", values }}
          comparison={compareCategories(categories, values, values)}
          selected="12"
          onSelect={() => undefined}
        />
      );
      const counts = [...container.querySelectorAll("[data-testid=totals-grid] > div")].map(
        (row) => row.querySelectorAll("button").length
      );
      unmount();
      return counts;
    };
    expect(rows(STANDARD_CATEGORIES)).toEqual([9]);
    expect(rows(TEN_CATEGORIES)).toEqual([5, 5]);
    expect(rows([...TEN_CATEGORIES, CATEGORY.tpm, CATEGORY.astTo])).toEqual([6, 6]);
  });
});
