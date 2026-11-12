/**
 * @vitest-environment happy-dom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UserLeague } from "@shared/api/leagues";
import { LeagueSwitcher } from "../../../client/src/features/league/LeagueSwitcher";

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

const GOING = league("478.l.1", "Going", "active");
const LEAGUES = [
  GOING,
  league("478.l.2", "Upcoming", "preseason"),
  league("466.l.3", "Done", "finished"),
];

describe("the header's league switcher", () => {
  it("titles the page with the league's name", () => {
    render(<LeagueSwitcher league={GOING} leagues={LEAGUES} onPick={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Going/);
  });

  it("notes leagues that haven't started or are over, and not ones in progress", () => {
    render(<LeagueSwitcher league={GOING} leagues={LEAGUES} onPick={vi.fn()} />);

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Going (2026)",
      "Upcoming (2026) – preseason",
      "Done (2026) – finished",
    ]);
  });

  it("picks another league", async () => {
    const onPick = vi.fn();
    render(<LeagueSwitcher league={GOING} leagues={LEAGUES} onPick={onPick} />);

    await userEvent.selectOptions(screen.getByLabelText("League"), "466.l.3");

    expect(onPick).toHaveBeenCalledWith("466.l.3");
  });

  it("is only a title when there is one league", () => {
    render(<LeagueSwitcher league={GOING} leagues={[GOING]} onPick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Going" })).toBeInTheDocument();
    expect(screen.queryByLabelText("League")).not.toBeInTheDocument();
  });
});
