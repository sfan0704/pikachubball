import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../../server/config/config";
import { createServerDependencies } from "../../../server/http/composition-root";
import { YahooDailyStatsSource } from "../../../server/fantasy/yahoo-daily-stats-source";
import type { YahooApiClient } from "../../../server/fantasy/yahoo/yahoo-api-client";
import { buildTestConfig, silentLogger } from "../../support/dependencies";
import { replayYahoo } from "../../support/yahoo-recordings";

const constructed = vi.hoisted(() => ({ count: 0 }));

vi.mock("../../../server/fantasy/fixture/fixture-daily-stats-source", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../server/fantasy/fixture/fixture-daily-stats-source")
    >();
  return {
    FixtureDailyStatsSource: class extends actual.FixtureDailyStatsSource {
      constructor(clock: { now(): number }) {
        super(clock);
        constructed.count += 1;
      }
    },
  };
});

const PRODUCTION = {
  NODE_ENV: "production",
  APP_ORIGIN: "https://basketball.example.test",
  SUPABASE_URL: "https://basketball-project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  ENCRYPTION_KEY: "0123456789abcdef".repeat(4),
};

describe("daily-stats wiring", () => {
  it("builds the Yahoo source in production, never the fixture, with Matchup and League on and Players off", async () => {
    constructed.count = 0;

    const dependencies = createServerDependencies(loadConfig(PRODUCTION));

    expect(dependencies.features).toEqual({
      matchupAndLeague: true,
      players: false,
      projections: false,
    });
    expect(dependencies.projectionSource).toBeNull();
    const yahoo = replayYahoo({ "/game/478/game_weeks": "daily-stats/fan-91-week-2/game-weeks" });
    const source = dependencies.createDailyStatsSource?.({
      yahooClient: async () => yahoo as unknown as YahooApiClient,
      logger: silentLogger,
    });
    expect(source).toBeInstanceOf(YahooDailyStatsSource);
    await expect(source?.getWeeks("478.l.100000")).resolves.toHaveProperty("weeks");
    expect(yahoo.calls).toEqual(["/game/478/game_weeks"]);
    expect(constructed.count).toBe(0);
  });

  it("serves the fixture source and turns Matchup, League and Players on with the Yahoo stand-in", async () => {
    constructed.count = 0;

    const dependencies = createServerDependencies(
      buildTestConfig({ localStack: true, localDailyStats: "fixture" })
    );

    expect(dependencies.features).toEqual({
      matchupAndLeague: true,
      players: true,
      projections: false,
    });
    expect(constructed.count).toBe(1);
    const source = dependencies.createDailyStatsSource?.({
      yahooClient: async () => {
        throw new Error("the fixture source never calls Yahoo");
      },
      logger: silentLogger,
    });
    await expect(source?.getWeeks("466.l.100000")).resolves.toHaveProperty("weeks");
  });

  it("reads the Yahoo stand-in through the Yahoo source for the load test, with every screen on", async () => {
    constructed.count = 0;

    const dependencies = createServerDependencies(
      buildTestConfig({ localStack: true, localDailyStats: "standin" })
    );

    expect(dependencies.features).toEqual({
      matchupAndLeague: true,
      players: true,
      projections: false,
    });
    const yahoo = replayYahoo({ "/game/478/game_weeks": "daily-stats/fan-91-week-2/game-weeks" });
    const source = dependencies.createDailyStatsSource?.({
      yahooClient: async () => yahoo as unknown as YahooApiClient,
      logger: silentLogger,
    });
    expect(source).toBeInstanceOf(YahooDailyStatsSource);
    expect(constructed.count).toBe(0);
  });
});
