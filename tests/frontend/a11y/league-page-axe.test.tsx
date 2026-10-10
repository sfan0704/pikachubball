/**
 * @vitest-environment happy-dom
 */
import React from "react";
import { readFileSync } from "node:fs";
import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
              isFinished: false,
              syncedAt: "2026-10-08T01:00:00.000+00:00",
            },
          ],
        });
      }
      if (url.endsWith("/roster")) {
        return jsonResponse({
          fetchedAt: "2025-12-11T18:00:00.000Z",
          roster: [
            { playerKey: "466.p.1", name: "P", position: "PG", team: "LAL", status: "active" },
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

describe("the league page has no structural accessibility violations", () => {
  it.each(["rankings", "heatmap", "matchup", "compare", "roster", "account"])(
    "%s tab",
    async (tab) => {
      stubApi();
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { container } = render(
        <QueryClientProvider client={client}>
          <AuthProvider>
            <Router
              hook={memoryLocation({ path: `/leagues/${LEAGUE_KEY}/teams/${MY_TEAM}/1` }).hook}
            >
              <LeaguePage />
            </Router>
          </AuthProvider>
        </QueryClientProvider>
      );
      await screen.findByRole("tab", { name: "rankings" });
      await userEvent.click(await screen.findByRole("tab", { name: tab }));
      await screen.findByRole("tabpanel");
      await vi.waitFor(() => expect(screen.queryByRole("status", { name: "Loading" })).toBeNull());

      expect(await violations(container)).toEqual([]);
    }
  );
});
