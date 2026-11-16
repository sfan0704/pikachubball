/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TeamTable } from "@shared/domain";
import {
  CategoryAllPlay,
  TeamStanding,
} from "../../../client/src/features/daily-stats/TeamStanding";
import { weekAllPlay } from "../../../client/src/features/daily-stats/league-standings-model";
import type { AllPlayState } from "../../../client/src/features/daily-stats/useLeagueAllPlay";
import { buildTeamTable } from "../../support/builders";

const T = (n: number) => `466.l.1.t.${n}`;
const STRONG = {
  pts: 700,
  reb: 300,
  ast: 200,
  stl: 60,
  blk: 40,
  tpm: 90,
  to: 50,
  fgm: 260,
  ftm: 90,
};
const WEAK = {
  pts: 400,
  reb: 150,
  ast: 90,
  stl: 20,
  blk: 10,
  tpm: 30,
  to: 90,
  fgm: 200,
  ftm: 60,
};

/** Team 4 meets the strongest team, loses PTS and REB and ties the rest: ties and bad luck. */
function week(): TeamTable {
  return buildTeamTable([STRONG, WEAK, { ...WEAK, pts: 450 }, { ...STRONG, pts: 650, reb: 250 }], {
    pairings: [
      { teamKeys: [T(1), T(4)], winnerTeamKey: T(1), isTied: false },
      { teamKeys: [T(2), T(3)], winnerTeamKey: T(3), isTied: false },
    ],
  });
}

function ready(table: TeamTable): AllPlayState {
  return { table: weekAllPlay(table), error: null, retry: () => undefined };
}

function sheet(table: TeamTable, allPlay: AllPlayState, teamKey = T(4), allPlayErrorShown = false) {
  return render(
    <>
      <TeamStanding
        table={table}
        teamKey={teamKey}
        allPlay={allPlay}
        allPlayErrorShown={allPlayErrorShown}
        onPickLeague={() => undefined}
      />
      <CategoryAllPlay table={table} teamKey={teamKey} allPlay={allPlay} />
    </>
  );
}

const lines = () => screen.getAllByTestId("luck-line").map((line) => line.textContent);

describe("TeamStanding", () => {
  it("shows the strip and works out negative luck with ties as half", () => {
    const table = week();
    sheet(table, ready(table));

    const strip = screen.getByTestId("team-summary");
    expect(within(strip).getByText("Standing").parentElement).toHaveTextContent("Standing4th0–2–7");
    expect(within(strip).getByText("All-play").parentElement).toHaveTextContent(
      "All-play2nd18–2–7"
    );
    expect(within(strip).getByText("Luck").parentElement).toHaveTextContent(
      "Luck−3.7category wins"
    );
    expect(screen.getByRole("region", { name: "How luck is worked out" })).toBeInTheDocument();
    expect(lines()).toEqual([
      "Real wins0 won + 7 ties as half3.5",
      "Expected79.6% all-play × 9 categories7.2",
      "Luckthe schedule hurt−3.7",
    ]);
  });

  it("shows positive luck as the schedule helping", () => {
    const table = week();
    sheet(table, ready(table), T(3));
    expect(lines().at(-1)).toBe("Luckthe schedule helped+3.3");
  });

  it("hides per-category all-play on a single week", () => {
    const table = week();
    sheet(table, ready(table));
    expect(screen.queryByTestId("category-all-play")).toBeNull();
  });

  it("lists all-play by the league's categories on the season", () => {
    const weekTable = week();
    const season: TeamTable = { ...weekTable, scope: { kind: "season" } };
    sheet(season, ready(weekTable));
    const cells = within(screen.getByTestId("category-all-play")).getAllByRole("listitem");
    expect(cells).toHaveLength(season.settings.categories.length);
    expect(screen.getByRole("heading", { name: "All-play by category" })).toBeInTheDocument();
  });

  it("shows dashes and no maths while all-play loads", () => {
    sheet(week(), { table: null, error: null, retry: () => undefined });
    expect(screen.queryByTestId("luck-math")).toBeNull();
    expect(screen.getByText("Luck").parentElement).toHaveTextContent("Luck—category wins");
  });

  it("says when all-play failed and retries it", async () => {
    const retry = vi.fn();
    const error = new Error("Yahoo is down");
    sheet(week(), { table: null, error, retry });
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("leaves all-play's failure to the Standings beside a panel, so it isn't said twice", () => {
    const error = new Error("Yahoo is down");
    sheet(week(), { table: null, error, retry: vi.fn() }, T(4), true);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("team-summary")).toBeInTheDocument();
  });
});
