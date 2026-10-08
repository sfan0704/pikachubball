import { readFileSync } from "node:fs";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { teamTableSchema } from "../../../shared/api/team-table";
import { createApp } from "../../../server/app";
import { createAppErrorHandler } from "../../../server/composition-root";
import { YahooFantasyDataSource } from "../../../server/fantasy/fantasy-data-source";
import type { LeagueResources } from "../../../server/fantasy/league-resources";
import {
  YahooRateLimitedError,
  YahooReconnectRequiredError,
  YahooUnavailableError,
} from "../../../server/services/yahoo/yahoo-request-policy";
import type { OwnerScopedStorage } from "../../../server/storage/yahoo-token-storage";
import { buildTestDependencies } from "../../support/dependencies";

const LEAGUE = "466.l.100000";

const verifiedClient = {
  auth: {
    getClaims: async () => ({ data: { claims: { sub: "user-1" } }, error: null }),
    getUser: async () => ({
      data: {
        user: {
          id: "user-1",
          identities: [
            {
              provider: "custom:yahoo",
              identity_data: { iss: "https://api.login.yahoo.com", sub: "yahoo-guid-1" },
            },
          ],
          user_metadata: {},
          app_metadata: {},
        },
      },
      error: null,
    }),
  },
} as unknown as SupabaseClient;

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`tests/backend/fixtures/yahoo/${name}.json`, "utf8"));
}

function buildApp(options: { member?: boolean; resources?: Partial<LeagueResources> } = {}) {
  const resources: LeagueResources = {
    getSeasonStandings: vi.fn(async () => fixture("league-season")),
    getCurrentWeekScoreboard: vi.fn(async () => fixture("league-current-week")),
    getPastWeekScoreboard: vi.fn(async () => fixture("league-week-1")),
    ...options.resources,
  };
  const ownsLeague = vi.fn().mockResolvedValue(options.member ?? true);
  const storage = { ownsLeague } as unknown as OwnerScopedStorage;
  const dependencies = buildTestDependencies({
    createSupabaseClient: () => verifiedClient,
    createOwnerStorage: () => storage,
    createFantasyDataSource: () =>
      new YahooFantasyDataSource(resources, { now: () => Date.parse("2025-12-11T18:00:00Z") }),
  });
  const app = createApp(dependencies);
  app.use(createAppErrorHandler(dependencies));
  return { app, resources, ownsLeague };
}

describe("GET /api/leagues/:key/:scope", () => {
  it("returns the season table for a member with one Yahoo call", async () => {
    const { app, resources, ownsLeague } = buildApp();

    const response = await request(app).get(`/api/leagues/${LEAGUE}/season`);

    expect(response.status).toBe(200);
    expect(ownsLeague).toHaveBeenCalledWith(LEAGUE);
    expect(resources.getSeasonStandings).toHaveBeenCalledTimes(1);
    expect(teamTableSchema.parse(response.body)).toMatchObject({
      scope: { kind: "season" },
      fetchedAt: "2025-12-11T18:00:00.000Z",
    });
    expect(response.body.teams).toHaveLength(14);
    expect(response.headers["cache-control"]).toMatch(/no-store/);
  });

  it("returns the current week and a past week, each with its pairings", async () => {
    const { app, resources } = buildApp();

    const current = await request(app).get(`/api/leagues/${LEAGUE}/current`);
    const past = await request(app).get(`/api/leagues/${LEAGUE}/1`);

    expect(current.body.scope).toEqual({ kind: "week", week: 8 });
    expect(past.body.scope).toEqual({ kind: "week", week: 1 });
    expect(past.body.pairings).toHaveLength(7);
    expect(resources.getCurrentWeekScoreboard).toHaveBeenCalledTimes(1);
    expect(resources.getPastWeekScoreboard).toHaveBeenCalledWith(LEAGUE, 1);
  });

  it("refuses a league that is not the user's without calling Yahoo", async () => {
    const { app, resources } = buildApp({ member: false });

    const response = await request(app).get(`/api/leagues/466.l.999/season`);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: "FORBIDDEN" });
    expect(resources.getSeasonStandings).not.toHaveBeenCalled();
    expect(resources.getCurrentWeekScoreboard).not.toHaveBeenCalled();
  });

  it.each([
    ["YAHOO_RECONNECT_REQUIRED", 401, new YahooReconnectRequiredError()],
    ["YAHOO_RATE_LIMITED", 429, new YahooRateLimitedError(30)],
    ["YAHOO_UNAVAILABLE", 503, new YahooUnavailableError()],
  ])("returns %s when Yahoo fails that way", async (code, status, error) => {
    const { app } = buildApp({
      resources: {
        getSeasonStandings: vi.fn().mockRejectedValue(error),
      },
    });

    const response = await request(app).get(`/api/leagues/${LEAGUE}/season`);

    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ code });
  });

  it("returns YAHOO_UNAVAILABLE when Yahoo's data cannot be read", async () => {
    const { app } = buildApp({
      resources: { getSeasonStandings: vi.fn().mockResolvedValue({ fantasy_content: {} }) },
    });

    const response = await request(app).get(`/api/leagues/${LEAGUE}/season`);

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("YAHOO_UNAVAILABLE");
  });

  it.each(["0", "week-3", "1000", "03", "Season"])("rejects the scope %s", async (scope) => {
    const { app, ownsLeague } = buildApp();

    const response = await request(app).get(`/api/leagues/${LEAGUE}/${scope}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(ownsLeague).not.toHaveBeenCalled();
  });

  it("rejects a malformed league key", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/api/leagues/not-a-key/season");

    expect(response.status).toBe(400);
  });

  it("requires a signed-in user", async () => {
    const dependencies = buildTestDependencies();
    const app = createApp(dependencies);
    app.use(createAppErrorHandler(dependencies));

    const response = await request(app).get(`/api/leagues/${LEAGUE}/season`);

    expect(response.status).toBe(401);
  });
});
