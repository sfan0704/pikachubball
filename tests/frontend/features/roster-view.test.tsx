/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rosterResponseSchema } from "@shared/api/leagues";
import { RosterPanel, RosterView } from "../../../client/src/features/league/RosterView";
import { jsonResponse } from "../../support/fetch";

// A roster response as the API returns it.
const RESPONSE = rosterResponseSchema.parse({
  fetchedAt: "2026-01-15T12:00:00.000Z",
  roster: [
    { playerKey: "466.p.1", name: "Test Guard", position: "PG,SG", team: "LAL", status: "active" },
    {
      playerKey: "466.p.2",
      name: "Test Forward",
      position: "SF,PF",
      team: "BOS",
      status: "injured",
    },
    { playerKey: "466.p.3", name: "Test Center", position: "C", team: "DEN", status: "out" },
  ],
});

afterEach(() => vi.unstubAllGlobals());

function panel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Router hook={memoryLocation({ path: "/" }).hook}>
        <RosterPanel
          leagueKey="466.l.1"
          teamKey="466.l.1.t.3"
          teamName="My Team"
          onPickLeague={vi.fn()}
        />
      </Router>
    </QueryClientProvider>
  );
}

describe("RosterView", () => {
  it("shows each player's name, eligibility, NBA team and status as text, and the date it applies to", () => {
    render(<RosterView data={RESPONSE} teamName="My Team" />);

    expect(screen.getByText("My Team roster")).toBeInTheDocument();
    expect(screen.getByText(/^Roster as of /)).toBeInTheDocument();
    const forward = screen.getByTestId("roster-player-466.p.2");
    expect(within(forward).getByText("Test Forward")).toBeInTheDocument();
    expect(within(forward).getByText("SF,PF · BOS")).toBeInTheDocument();
    expect(within(forward).getByText("Injured")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("roster-player-466.p.3")).getByText("Out")
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("says so when the roster is empty", () => {
    render(<RosterView data={{ ...RESPONSE, roster: [] }} teamName="My Team" />);

    expect(screen.getByRole("status")).toHaveTextContent("Yahoo lists no players");
  });
});

describe("RosterPanel", () => {
  it("loads the selected team's roster through the API", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    panel();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(await screen.findByText("Test Guard")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/466.l.1/teams/466.l.1.t.3/roster",
      expect.anything()
    );
  });

  it("shows the error screen when the roster can't be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ code: "YAHOO_UNAVAILABLE", message: "x", requestId: "req-5" }, 503)
      )
    );

    panel();

    expect(await screen.findByRole("alert")).toHaveTextContent("Yahoo isn't responding");
  });
});
