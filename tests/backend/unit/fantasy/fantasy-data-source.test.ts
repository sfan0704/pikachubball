import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "../../../../shared/api/errors";
import { YahooFantasyDataSource } from "../../../../server/fantasy/fantasy-data-source";
import {
  YahooLeagueResources,
  type LeagueResources,
} from "../../../../server/fantasy/league-resources";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`tests/backend/fixtures/yahoo/${name}.json`, "utf8"));
}

const NOW = Date.parse("2025-12-11T18:00:00.000Z");

describe("YahooFantasyDataSource", () => {
  const resources: LeagueResources = {
    getSeasonStandings: vi.fn(async () => fixture("league-season")),
    getCurrentWeekScoreboard: vi.fn(async () => fixture("league-current-week")),
    getPastWeekScoreboard: vi.fn(async () => fixture("league-week-1")),
  };
  const source = new YahooFantasyDataSource(resources, { now: () => NOW });

  it("makes one call for the season and stamps the fetch time from the clock", async () => {
    const table = await source.getSeason("466.l.100000");

    expect(resources.getSeasonStandings).toHaveBeenCalledOnce();
    expect(resources.getSeasonStandings).toHaveBeenCalledWith("466.l.100000");
    expect(table.scope).toEqual({ kind: "season" });
    expect(table.fetchedAt).toBe("2025-12-11T18:00:00.000Z");
  });

  it("makes one call for the current week and one for a past week", async () => {
    const current = await source.getWeek("466.l.100000", "current");
    const past = await source.getWeek("466.l.100000", 1);

    expect(resources.getCurrentWeekScoreboard).toHaveBeenCalledOnce();
    expect(resources.getPastWeekScoreboard).toHaveBeenCalledWith("466.l.100000", 1);
    expect(current.scope).toEqual({ kind: "week", week: 8 });
    expect(past.scope).toEqual({ kind: "week", week: 1 });
  });
});

describe("YahooLeagueResources", () => {
  const get = vi.fn(async (_endpoint: string) => ({}));
  const resources = new YahooLeagueResources(async () => ({ get }));

  it("asks Yahoo for the settings together with the stats, once per table", async () => {
    await resources.getSeasonStandings("466.l.12345");
    await resources.getCurrentWeekScoreboard("466.l.12345");
    await resources.getPastWeekScoreboard("466.l.12345", 3);

    expect(get.mock.calls.map(([endpoint]) => endpoint)).toEqual([
      "/league/466.l.12345;out=settings,standings",
      "/league/466.l.12345;out=settings,scoreboard",
      "/league/466.l.12345;out=settings/scoreboard;week=3",
    ]);
  });

  it("refuses a league key or week that could change the path, before calling Yahoo", async () => {
    get.mockClear();

    await expect(resources.getSeasonStandings("466.l.1/../users")).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(resources.getPastWeekScoreboard("466.l.1", 0)).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(resources.getPastWeekScoreboard("466.l.1", 1.5)).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(get).not.toHaveBeenCalled();
  });
});
