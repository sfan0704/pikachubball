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
    getUserTeams: vi.fn(async () => fixture("captured/user-teams")),
    getUserLeagues: vi.fn(async () => fixture("captured/user-leagues")),
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

  it("lists the user's leagues from one teams call and one leagues call", async () => {
    const leagues = await source.listLeagues();

    expect(resources.getUserTeams).toHaveBeenCalledOnce();
    expect(resources.getUserLeagues).toHaveBeenCalledOnce();
    expect(leagues).toHaveLength(19);
  });

  it.each([
    ["the evening before the start, in New York", "2026-10-20T03:59:00Z", "preseason"],
    ["the morning of the start, in New York", "2026-10-20T04:01:00Z", "active"],
  ])("dates league starts by the NBA's timezone: %s", async (_when, now, status) => {
    const atNow = new YahooFantasyDataSource(resources, { now: () => Date.parse(now) });

    const leagues = await atNow.listLeagues();

    expect(leagues.find((league) => league.leagueKey === "478.l.14822")?.status).toBe(status);
  });
});

describe("YahooLeagueResources", () => {
  const get = vi.fn(async (_endpoint: string) => ({}));
  const resources = new YahooLeagueResources(async () => ({ get }));

  it("asks Yahoo for the user's NBA teams and leagues", async () => {
    await resources.getUserTeams();
    await resources.getUserLeagues();

    expect(get.mock.calls.map(([endpoint]) => endpoint)).toEqual([
      "/users;use_login=1/games;game_codes=nba/teams",
      "/users;use_login=1/games;game_codes=nba/leagues",
    ]);
  });

  it("asks Yahoo for the settings together with the stats, once per table", async () => {
    get.mockClear();
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
