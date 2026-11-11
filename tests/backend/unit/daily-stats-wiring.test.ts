import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../../server/config/config";
import { createServerDependencies } from "../../../server/http/composition-root";
import { buildTestConfig } from "../../support/dependencies";

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
  it("turns every daily-stats switch off in production and never builds the fixture source", () => {
    constructed.count = 0;

    const dependencies = createServerDependencies(loadConfig(PRODUCTION));

    expect(dependencies.features).toEqual({
      matchupAndLeague: false,
      players: false,
      projections: false,
    });
    expect(dependencies.createDailyStatsSource).toBeNull();
    expect(dependencies.projectionSource).toBeNull();
    expect(constructed.count).toBe(0);
  });

  it("serves the fixture source and turns Matchup, League and Players on with the Yahoo stand-in", async () => {
    constructed.count = 0;

    const dependencies = createServerDependencies(buildTestConfig({ localStack: true }));

    expect(dependencies.features).toEqual({
      matchupAndLeague: true,
      players: true,
      projections: false,
    });
    expect(constructed.count).toBe(1);
    const source = dependencies.createDailyStatsSource?.(async () => {
      throw new Error("the fixture source never calls Yahoo");
    });
    await expect(source?.getWeeks("466.l.100000")).resolves.toHaveProperty("weeks");
  });
});
