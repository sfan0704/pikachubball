import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  draftResponseSchema,
  gameLogsResponseSchema,
  playerListResponseSchema,
  playerStatsResponseSchema,
  scheduleResponseSchema,
  teamDayResponseSchema,
  transactionsResponseSchema,
  weeksResponseSchema,
} from "../../../shared/api/daily-stats";
import { createApp } from "../../../server/http/app";
import { createAppErrorHandler } from "../../../server/http/composition-root";
import { FixtureDailyStatsSource } from "../../../server/fantasy/fixture/fixture-daily-stats-source";
import type { OwnerScopedStorage } from "../../../server/storage/yahoo-token-storage";
import { fixedClock } from "../../support/clock";
import {
  buildTestDependencies,
  openedRequest,
  signedInSupabaseClient,
} from "../../support/dependencies";

const LEAGUE = "466.l.100000";
const TEAM = `${LEAGUE}.t.11`;
const NOW = "2026-11-11T20:00:00.000Z";
const PLAYERS = [`466.p.11101`, `466.p.11102`];

function buildApp(options: { member?: boolean; wired?: boolean } = {}) {
  const clock = fixedClock(NOW);
  const source = new FixtureDailyStatsSource(clock);
  const ownsLeague = vi.fn().mockResolvedValue(options.member ?? true);
  const storage = { openRequest: openedRequest, ownsLeague } as unknown as OwnerScopedStorage;
  const dependencies = buildTestDependencies({
    clock,
    createSupabaseClient: () => signedInSupabaseClient,
    createOwnerStorage: () => storage,
    createDailyStatsSource: options.wired === false ? null : () => source,
  });
  const app = createApp(dependencies);
  app.use(createAppErrorHandler(dependencies));
  return { app, ownsLeague };
}

const ENDPOINTS = [
  { path: `/api/leagues/${LEAGUE}/teams/${TEAM}/days/2026-11-11`, schema: teamDayResponseSchema },
  {
    path: `/api/leagues/${LEAGUE}/games?players=${PLAYERS.join(",")}`,
    schema: gameLogsResponseSchema,
  },
  {
    path: `/api/leagues/${LEAGUE}/player-stats/last7?players=${PLAYERS.join(",")}`,
    schema: playerStatsResponseSchema,
  },
  {
    path: `/api/leagues/${LEAGUE}/players?status=available&sort=actualRank&start=0`,
    schema: playerListResponseSchema,
  },
  { path: `/api/leagues/${LEAGUE}/schedule`, schema: scheduleResponseSchema },
  { path: `/api/leagues/${LEAGUE}/teams/${TEAM}/transactions`, schema: transactionsResponseSchema },
  { path: `/api/leagues/${LEAGUE}/draft`, schema: draftResponseSchema },
  { path: `/api/leagues/${LEAGUE}/weeks`, schema: weeksResponseSchema },
] as const;

describe("daily-stats endpoints on the fixture source", () => {
  it.each(ENDPOINTS)(
    "$path returns contract-valid data stamped with its fetch time",
    async ({ path, schema }) => {
      const { app, ownsLeague } = buildApp();

      const response = await request(app).get(path);

      expect(response.status).toBe(200);
      expect(ownsLeague).toHaveBeenCalledWith(LEAGUE);
      expect(schema.parse(response.body)).toMatchObject({ fetchedAt: NOW });
      expect(response.headers["cache-control"]).toMatch(/no-store/);
    }
  );

  it.each(ENDPOINTS)("$path refuses a league the user doesn't have", async ({ path }) => {
    const { app } = buildApp({ member: false });

    const response = await request(app).get(path);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  it.each(ENDPOINTS)(
    "$path is NOT_FOUND where no daily-stats source is wired",
    async ({ path }) => {
      const { app, ownsLeague } = buildApp({ wired: false });

      const response = await request(app).get(path);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("NOT_FOUND");
      expect(ownsLeague).not.toHaveBeenCalled();
    }
  );

  it.each([
    [`/api/leagues/not-a-league/weeks`],
    [`/api/leagues/${LEAGUE}/teams/466.l.200000.t.1/days/2026-11-11`],
    [`/api/leagues/${LEAGUE}/teams/${TEAM}/days/11-11-2026`],
    [`/api/leagues/${LEAGUE}/teams/not-a-team/transactions`],
    [`/api/leagues/${LEAGUE}/games?players=478.p.11101`],
    [`/api/leagues/${LEAGUE}/games?players=466.p.11101,466.p.11101`],
    [`/api/leagues/${LEAGUE}/games`],
    [`/api/leagues/${LEAGUE}/player-stats/lastyear?players=466.p.11101`],
    [`/api/leagues/${LEAGUE}/players?status=everyone&sort=actualRank&start=0`],
    [`/api/leagues/${LEAGUE}/players?status=owned&sort=actualRank&start=10`],
  ])("rejects %s with VALIDATION_ERROR before reading the league", async (path) => {
    const { app, ownsLeague } = buildApp();

    const response = await request(app).get(path);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(ownsLeague).not.toHaveBeenCalled();
  });

  it("rejects more players than one request may name", async () => {
    const { app } = buildApp();
    const players = Array.from({ length: 51 }, (_, index) => `466.p.${20001 + index}`);

    const response = await request(app).get(`/api/leagues/${LEAGUE}/games?players=${players}`);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    [`/api/leagues/${LEAGUE}/teams/${LEAGUE}.t.99/days/2026-11-11`],
    [`/api/leagues/${LEAGUE}/teams/${LEAGUE}.t.99/transactions`],
    [`/api/leagues/${LEAGUE}/games?players=466.p.99999`],
    [`/api/leagues/${LEAGUE}/player-stats/season?players=466.p.11101,466.p.99999`],
  ])("answers NOT_FOUND for %s, a team or player the league doesn't have", async (path) => {
    const { app } = buildApp();

    const response = await request(app).get(path);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("NOT_FOUND");
  });

  it("still serves the league scope route next to the dataset routes", async () => {
    const { app } = buildApp();

    const response = await request(app).get(`/api/leagues/${LEAGUE}/not-a-scope`);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});
