import { readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../../shared/api/errors";
import { createApp } from "../../../server/http/app";
import { createAppErrorHandler } from "../../../server/http/composition-root";
import { YahooFantasyDataSource } from "../../../server/fantasy/fantasy-data-source";
import { YahooLeagueResources } from "../../../server/fantasy/league-resources";
import type { YahooApiClient } from "../../../server/fantasy/yahoo/yahoo-api-client";
import { getTeamRoster } from "../../../server/fantasy/yahoo/roster-service";
import type { OwnerScopedStorage } from "../../../server/storage/yahoo-token-storage";
import { buildTestDependencies } from "../../support/dependencies";
import { fixedClock } from "../../support/clock";

vi.mock("../../../server/fantasy/yahoo/roster-service");

const CAPTURED = join(__dirname, "../fixtures/yahoo/captured");
const RECORDED: Record<string, string> = {
  "/users;use_login=1/games;game_codes=nba/teams": "user-teams.json",
  "/users;use_login=1/games;game_codes=nba/leagues": "user-leagues.json",
};

/** Answers Yahoo calls with the recorded responses. */
const yahooGet = vi.fn(async (path: string): Promise<unknown> => {
  const file = RECORDED[path];
  if (!file) {
    throw new Error(`nothing recorded for ${path}`);
  }
  return JSON.parse(readFileSync(join(CAPTURED, file), "utf8"));
});

const createFantasyDataSource = () =>
  new YahooFantasyDataSource(new YahooLeagueResources(async () => ({ get: yahooGet })), {
    now: () => Date.parse("2026-10-10T16:00:00Z"),
  });

const APP_ORIGIN = "https://basketball.example.test";

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

const STORED_LEAGUE = {
  leagueKey: "466.l.1",
  teamKey: "466.l.1.t.3",
  name: "League One",
  season: 2025,
  isFinished: false,
  syncedAt: "2026-10-08T01:00:00.000+00:00",
};

function buildApp(
  options: { member?: boolean; stored?: (typeof STORED_LEAGUE)[]; now?: string } = {}
) {
  const storage = {
    getYahooToken: vi.fn(async () => ({ userId: "user-1", refreshToken: "r" })),
    getPreferences: vi.fn(async () => ({
      selectedLeagueKey: "466.l.1",
      selectedTeamKey: null,
      display: {},
    })),
    savePreferences: vi.fn(async () => undefined),
    listUserLeagues: vi.fn(async () => options.stored ?? [STORED_LEAGUE]),
    replaceUserLeagues: vi.fn(async () => undefined),
    ownsLeague: vi.fn(async () => options.member ?? true),
  } as unknown as OwnerScopedStorage;
  const dependencies = buildTestDependencies({
    createSupabaseClient: () => verifiedClient,
    createOwnerStorage: () => storage,
    createYahooClient: async () => ({}) as unknown as YahooApiClient,
    createFantasyDataSource,
    clock: fixedClock(options.now ?? "2026-10-10T16:00:00.000Z"),
  });
  const app = createApp(dependencies);
  app.use(createAppErrorHandler(dependencies));
  return { app, storage };
}

beforeEach(() => {
  yahooGet.mockClear();
  vi.mocked(getTeamRoster)
    .mockReset()
    .mockResolvedValue([
      { playerKey: "466.p.1", name: "Test Player", position: "PG", team: "LAL", status: "active" },
    ]);
});

describe("GET /api/me", () => {
  it("returns the user, the Yahoo connection and the saved choices", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/api/me");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { id: "user-1", displayName: null, email: null },
      yahoo: { connected: true },
      preferences: { selectedLeagueKey: "466.l.1", selectedTeamKey: null, display: {} },
    });
  });

  it("requires a signed-in user", async () => {
    const dependencies = buildTestDependencies();
    const app = createApp(dependencies);
    app.use(createAppErrorHandler(dependencies));

    expect((await request(app).get("/api/me")).status).toBe(401);
  });
});

describe("PUT /api/me/preferences", () => {
  const body = { selectedLeagueKey: "466.l.2", selectedTeamKey: "466.l.2.t.1", display: { x: 1 } };

  it("saves valid choices and returns what is stored", async () => {
    const { app, storage } = buildApp();

    const response = await request(app)
      .put("/api/me/preferences")
      .set("Origin", APP_ORIGIN)
      .send(body);

    expect(response.status).toBe(200);
    expect(storage.savePreferences).toHaveBeenCalledWith(body);
  });

  it.each([
    ["an unknown field", { ...body, extra: true }],
    ["a short league key", { ...body, selectedLeagueKey: "x" }],
    ["oversized display options", { ...body, display: { big: "x".repeat(5000) } }],
    ["a missing field", { selectedLeagueKey: null }],
  ])("rejects %s", async (_name, invalid) => {
    const { app, storage } = buildApp();

    const response = await request(app)
      .put("/api/me/preferences")
      .set("Origin", APP_ORIGIN)
      .send(invalid);

    expect(response.status).toBe(400);
    expect(storage.savePreferences).not.toHaveBeenCalled();
  });

  it("refuses another origin", async () => {
    const { app } = buildApp();

    const response = await request(app)
      .put("/api/me/preferences")
      .set("Origin", "https://evil.example")
      .send(body);

    expect(response.status).toBe(403);
  });
});

describe("GET /api/leagues", () => {
  it("returns the stored leagues without calling Yahoo", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/api/leagues");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ leagues: [STORED_LEAGUE] });
    expect(yahooGet).not.toHaveBeenCalled();
  });

  it("replaces the stored leagues with every league Yahoo lists when refreshing", async () => {
    const { app, storage } = buildApp();

    const response = await request(app).get("/api/leagues?refresh=true");

    expect(response.status).toBe(200);
    expect(yahooGet).toHaveBeenCalledTimes(2);
    const saved = vi.mocked(storage.replaceUserLeagues).mock.calls[0]?.[0];
    expect(saved).toHaveLength(19);
    expect(saved).toContainEqual({
      leagueKey: "478.l.52912",
      teamKey: "478.l.52912.t.5",
      name: "League-31",
      season: 2026,
      isFinished: false,
    });
    expect(saved).toContainEqual({
      leagueKey: "466.l.29849",
      teamKey: "466.l.29849.t.10",
      name: "League-33",
      season: 2025,
      isFinished: true,
    });
  });

  it("fetches the leagues from Yahoo on the first request when none are stored", async () => {
    const { app, storage } = buildApp({ stored: [] });

    const response = await request(app).get("/api/leagues");

    expect(response.status).toBe(200);
    expect(yahooGet).toHaveBeenCalledTimes(2);
    expect(vi.mocked(storage.replaceUserLeagues).mock.calls[0]?.[0]).toHaveLength(19);
  });

  describe("at season rollover, when every stored league is finished", () => {
    const finished = { ...STORED_LEAGUE, isFinished: true, syncedAt: "2026-10-08T16:00:00.000Z" };

    it("asks Yahoo for the new season on the next visit", async () => {
      const { app, storage } = buildApp({ stored: [finished], now: "2026-10-10T16:00:00.000Z" });

      expect((await request(app).get("/api/leagues")).status).toBe(200);
      expect(yahooGet).toHaveBeenCalledTimes(2);
      expect(storage.replaceUserLeagues).toHaveBeenCalledOnce();
    });

    it("asks at most once a day", async () => {
      const { app, storage } = buildApp({ stored: [finished], now: "2026-10-09T15:00:00.000Z" });

      expect((await request(app).get("/api/leagues")).status).toBe(200);
      expect(yahooGet).not.toHaveBeenCalled();
      expect(storage.replaceUserLeagues).not.toHaveBeenCalled();
    });

    it("doesn't ask while any stored league is still going", async () => {
      const { app } = buildApp({ stored: [finished, STORED_LEAGUE] });

      expect((await request(app).get("/api/leagues")).status).toBe(200);
      expect(yahooGet).not.toHaveBeenCalled();
    });
  });

  it("keeps the stored leagues when Yahoo fails", async () => {
    yahooGet.mockRejectedValueOnce(new AppError("YAHOO_UNAVAILABLE", "Yahoo is down"));
    const { app, storage } = buildApp();

    const response = await request(app).get("/api/leagues?refresh=true");

    expect(response.body.code).toBe("YAHOO_UNAVAILABLE");
    expect(storage.replaceUserLeagues).not.toHaveBeenCalled();
  });

  it("limits refreshes to one a minute but not plain reads", async () => {
    const dependencies = buildTestDependencies({
      config: { ...buildTestDependencies().config, nodeEnv: "production" },
      createSupabaseClient: () => verifiedClient,
      createOwnerStorage: () => buildApp().storage,
      createFantasyDataSource,
    });
    const app = createApp(dependencies);
    app.use(createAppErrorHandler(dependencies));

    const first = await request(app).get("/api/leagues?refresh=true");
    const second = await request(app).get("/api/leagues?refresh=true");
    const plain = await request(app).get("/api/leagues");

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.body.code).toBe("RATE_LIMITED");
    expect(second.headers["retry-after"]).toBeDefined();
    expect(plain.status).toBe(200);
  });

  it("rejects an unknown refresh value", async () => {
    const { app } = buildApp();

    expect((await request(app).get("/api/leagues?refresh=maybe")).status).toBe(400);
  });
});

describe("GET /api/leagues/:key/teams/:team/roster", () => {
  it("returns the roster for a league the user has", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/api/leagues/466.l.1/teams/466.l.1.t.3/roster");

    expect(response.status).toBe(200);
    expect(getTeamRoster).toHaveBeenCalledWith("466.l.1.t.3", expect.any(Function));
    expect(response.body.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(response.body.roster).toHaveLength(1);
    expect(response.body.roster[0]).toMatchObject({ playerKey: "466.p.1", name: "Test Player" });
  });

  it("refuses a league the user does not have, without calling Yahoo", async () => {
    const { app } = buildApp({ member: false });

    const response = await request(app).get("/api/leagues/466.l.7/teams/466.l.7.t.3/roster");

    expect(response.status).toBe(403);
    expect(getTeamRoster).not.toHaveBeenCalled();
  });

  it("rejects a team that is not in the league", async () => {
    const { app, storage } = buildApp();

    const response = await request(app).get("/api/leagues/466.l.1/teams/466.l.2.t.3/roster");

    expect(response.status).toBe(400);
    expect(storage.ownsLeague).not.toHaveBeenCalled();
    expect(getTeamRoster).not.toHaveBeenCalled();
  });
});
