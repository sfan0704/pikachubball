/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { readFileSync } from "node:fs";
import axe from "axe-core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FreshnessProvider } from "../../../client/src/api/freshness";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseWeekTable } from "../../../server/fantasy/league-tables";
import { AuthProvider } from "../../../client/src/lib/auth";
import LeaguePage from "../../../client/src/pages/LeaguePage";
import { jsonResponse } from "../../support/fetch";

const LEAGUE_KEY = "466.l.100000";
const MY_TEAM = `${LEAGUE_KEY}.t.11`;
const TABLE = parseWeekTable(
  JSON.parse(readFileSync("tests/backend/fixtures/yahoo/league-week-1.json", "utf8")),
  "2025-12-11T18:00:00.000Z",
  1
);

function stubApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/me") {
        return jsonResponse({
          user: { id: "u1", displayName: "Tester", email: null },
          yahoo: { connected: true },
          features: { matchupAndLeague: false, players: false, projections: false },
          preferences: { selectedLeagueKey: null, selectedTeamKey: null, display: {} },
        });
      }
      if (url === "/api/leagues") {
        return jsonResponse({
          leagues: [
            {
              leagueKey: LEAGUE_KEY,
              teamKey: MY_TEAM,
              name: "Test League",
              season: 2025,
              status: "active",
              syncedAt: "2026-10-08T01:00:00.000+00:00",
            },
          ],
        });
      }
      return jsonResponse(TABLE);
    })
  );
}

/** Structural checks (labels, roles, names, headings, table markup). Colour contrast is covered by the theme token test. */
async function violations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  return result.violations.map((violation) => `${violation.id}: ${violation.help}`);
}

afterEach(() => vi.unstubAllGlobals());

function renderPage() {
  stubApi();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FreshnessProvider>
        <AuthProvider>
          <Router hook={memoryLocation({ path: `/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/1` }).hook}>
            <LeaguePage />
          </Router>
        </AuthProvider>
      </FreshnessProvider>
    </QueryClientProvider>
  );
}

const loaded = () =>
  vi.waitFor(() => expect(screen.queryByRole("status", { name: "Loading" })).toBeNull());

describe("the league page has no structural accessibility violations", () => {
  it("League board", async () => {
    const { container } = renderPage();
    await screen.findByTestId("card-league-rankings");
    await loaded();

    expect(await violations(container)).toEqual([]);
  });

  it("Account dialog", async () => {
    renderPage();
    await screen.findByTestId("card-league-rankings");
    await userEvent.click(screen.getByRole("button", { name: "Account" }));
    const dialog = await screen.findByRole("dialog", { name: "Account" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete account" }));
    await loaded();

    // The dialog alone: happy-dom doesn't honour the inert page Radix leaves behind it,
    // which the browser test checks in a real browser.
    expect(await violations(dialog)).toEqual([]);
  });
});
