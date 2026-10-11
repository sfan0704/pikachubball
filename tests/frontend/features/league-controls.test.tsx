/**
 * @vitest-environment happy-dom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UserLeague } from "@shared/api/leagues";
import { LeagueControls } from "../../../client/src/features/league/LeagueControls";

function league(leagueKey: string, name: string, status: UserLeague["status"]): UserLeague {
  return {
    leagueKey,
    teamKey: `${leagueKey}.t.1`,
    name,
    season: 2026,
    status,
    syncedAt: "2026-10-10T20:00:00.000+00:00",
  };
}

describe("the league picker", () => {
  it("notes leagues that haven't started or are over, and not ones in progress", () => {
    const leagues = [
      league("478.l.1", "Going", "active"),
      league("478.l.2", "Upcoming", "preseason"),
      league("466.l.3", "Done", "finished"),
    ];

    render(
      <LeagueControls
        selection={{ leagueKey: "478.l.1", teamKey: "478.l.1.t.1", scope: "season" }}
        leagues={leagues}
        table={undefined}
        onSelect={vi.fn()}
      />
    );

    const options = screen.getAllByRole("option", { name: /Going|Upcoming|Done/ });
    expect(options.map((option) => option.textContent)).toEqual([
      "Going (2026)",
      "Upcoming (2026) – preseason",
      "Done (2026) – finished",
    ]);
  });
});
