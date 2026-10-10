/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compareWithAll, headToHead, opponentOf } from "@shared/domain";
import { parseSeasonTable, parseWeekTable } from "../../../server/fantasy/league-tables";
import { ComparisonView } from "../../../client/src/features/league/ComparisonView";
import { MatchupView } from "../../../client/src/features/league/MatchupView";
import {
  comparisonRows,
  differenceText,
  scoreText,
} from "../../../client/src/features/league/matchup-model";
import { buildTeamTable } from "../../support/builders";
import { defined } from "../../support/defined";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`tests/backend/fixtures/yahoo/${name}.json`, "utf8"));
}

const WEEK_1 = parseWeekTable(fixture("league-week-1"), "2025-12-11T18:00:00.000Z", 1);
const SEASON = parseSeasonTable(fixture("league-season"), "2025-12-11T18:00:00.000Z");
const MINE = "466.l.100000.t.11";

afterEach(() => vi.unstubAllGlobals());

describe("MatchupView", () => {
  it("shows Yahoo's opponent for the week with a tally equal to the domain head-to-head", () => {
    const opponent = defined(opponentOf(WEEK_1, MINE));
    const expected = defined(headToHead(WEEK_1, MINE, opponent));
    render(<MatchupView table={WEEK_1} myTeamKey={MINE} />);

    expect(screen.getByTestId("matchup-score")).toHaveTextContent(
      `${expected.score.wins}-${expected.score.losses}-${expected.score.ties}`
    );
    const results = screen
      .getAllByTestId(/^matchup-category-/)
      .map((row) => row.getAttribute("data-result"));
    expect(results).toEqual(expected.categories.map((category) => category.result));
    expect(screen.getByText(/^Week 1:/)).toBeInTheDocument();
  });

  it("writes every result out as text and names Yahoo as the source of the official result", () => {
    render(<MatchupView table={WEEK_1} myTeamKey={MINE} />);

    const row = screen.getByTestId("matchup-category-pts");
    expect(within(row).getByText(/^(Win|Loss|Tie)$/)).toBeInTheDocument();
    expect(screen.getByText(/^Yahoo's result:|^Yahoo hasn't declared/)).toBeInTheDocument();
    expect(screen.getByText(/Yahoo decides the official result/)).toBeInTheDocument();
  });

  it("asks for a week on a season table, and says so when there is no pairing", () => {
    const { unmount } = render(<MatchupView table={SEASON} myTeamKey={MINE} />);
    expect(screen.getByText("Choose a week to see a matchup.")).toBeInTheDocument();
    unmount();

    render(<MatchupView table={WEEK_1} myTeamKey="466.l.100000.t.999" />);
    expect(screen.getByText("Your team has no matchup in this week.")).toBeInTheDocument();
  });
});

describe("ComparisonView", () => {
  it("lists every other team with the domain's record, and opens a category breakdown", async () => {
    render(<ComparisonView table={WEEK_1} myTeamKey={MINE} />);

    const expected = compareWithAll(WEEK_1, MINE);
    expect(screen.getAllByTestId(/^comparison-/)).toHaveLength(13);
    const first = expected[0];
    const button = screen.getByTestId(`comparison-${first.opponentTeamKey}`);
    expect(button).toHaveTextContent(
      `${first.score.wins}-${first.score.losses}-${first.score.ties}`
    );

    await userEvent.click(button);

    expect(screen.getAllByTestId(/^matchup-category-/)).toHaveLength(9);
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("is labelled as observed totals, not a prediction", () => {
    render(<ComparisonView table={WEEK_1} myTeamKey={MINE} />);

    expect(screen.getByText(/not a prediction/)).toBeInTheDocument();
  });

  it("makes no request at all: everything comes from the week's table", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ComparisonView table={WEEK_1} myTeamKey={MINE} />);

    for (const button of screen.getAllByTestId(/^comparison-/)) {
      await userEvent.click(button);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("orders by wins and flags comparisons that include unknown numbers", () => {
    const table = buildTeamTable([{}, { pts: 100, reb: null }, { pts: 900 }]);

    const rows = comparisonRows(table, "466.l.1.t.1");

    expect(rows.map((row) => row.opponent.teamKey)).toEqual(["466.l.1.t.2", "466.l.1.t.3"]);
    expect(rows[0].complete).toBe(false);
    expect(rows[0].record).toContain("unavailable");
  });
});

describe("text helpers", () => {
  it("formats scores and differences without inventing numbers", () => {
    expect(scoreText({ wins: 5, losses: 3, ties: 1, unavailable: 0, complete: true })).toBe(
      "5-3-1"
    );
    expect(scoreText({ wins: 4, losses: 3, ties: 1, unavailable: 1, complete: false })).toBe(
      "4-3-1 (1 unavailable)"
    );
    expect(
      differenceText({
        category: "fgPct",
        mine: 0.5,
        theirs: 0.48,
        difference: 0.02,
        result: "win",
      })
    ).toBe("+2.0%");
    expect(
      differenceText({ category: "to", mine: 10, theirs: 14, difference: -4, result: "win" })
    ).toBe("-4");
    expect(
      differenceText({
        category: "pts",
        mine: null,
        theirs: 4,
        difference: null,
        result: "unavailable",
      })
    ).toBe("—");
  });
});
