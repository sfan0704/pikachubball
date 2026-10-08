import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { teamTableSchema } from "../../../../shared/api/team-table";
import { categoryRanks, scoringSupport } from "../../../../shared/domain";
import { parseSeasonTable, parseWeekTable } from "../../../../server/fantasy/league-tables";
import { YahooResponseError } from "../../../../server/fantasy/yahoo-shapes";

const FETCHED_AT = "2025-12-11T18:00:00.000Z";

function fixture(name: string): any {
  return JSON.parse(readFileSync(`tests/backend/fixtures/yahoo/${name}.json`, "utf8"));
}

/** The team fragments of the first team in a recorded season response. */
function firstSeasonTeam(response: any): any[] {
  return response.fantasy_content.league[2].standings[0].teams["0"].team;
}

describe("season table from the standings response", () => {
  const table = parseSeasonTable(fixture("league-season"), FETCHED_AT);

  it("reads the league settings", () => {
    expect(table.scope).toEqual({ kind: "season" });
    expect(table.fetchedAt).toBe(FETCHED_AT);
    expect(table.settings).toMatchObject({
      leagueKey: "466.l.100000",
      name: "Test League",
      season: 2025,
      scoringType: "head",
      startWeek: 1,
      endWeek: 22,
      currentWeek: 8,
      isFinished: false,
    });
    expect(table.pairings).toEqual([]);
  });

  it("lists the nine scoring categories and not the display-only columns", () => {
    expect(table.settings.categories.map((category) => category.key)).toEqual([
      "fgPct",
      "ftPct",
      "tpm",
      "pts",
      "reb",
      "ast",
      "stl",
      "blk",
      "to",
    ]);
    expect(table.settings.categories.find((category) => category.key === "to")?.direction).toBe(
      "lower"
    );
    expect(scoringSupport(table.settings)).toEqual({ supported: true });
  });

  it("reads every team's makes, attempts and counting totals", () => {
    expect(table.teams).toHaveLength(14);
    expect(table.teams.find((team) => team.teamKey === "466.l.100000.t.11")).toEqual({
      teamKey: "466.l.100000.t.11",
      teamName: "Team 11",
      managerName: "Manager 11",
      totals: {
        fgMakes: 1713,
        fgAttempts: 3579,
        ftMakes: 889,
        ftAttempts: 1162,
        tpm: 448,
        pts: 4763,
        reb: 1716,
        ast: 1023,
        stl: 313,
        blk: 180,
        to: 556,
      },
    });
  });

  it("matches the shared API schema and feeds the domain maths", () => {
    expect(teamTableSchema.parse(table)).toEqual(table);
    const ranks = categoryRanks(table);
    expect(Object.keys(ranks)).toHaveLength(14);
    expect(Object.values(ranks).every((row) => row.pts !== null)).toBe(true);
  });
});

describe("week table from the scoreboard response", () => {
  it("reads a past week with its matchup pairings", () => {
    const table = parseWeekTable(fixture("league-week-1"), FETCHED_AT, 1);

    expect(table.scope).toEqual({ kind: "week", week: 1 });
    expect(table.teams).toHaveLength(14);
    expect(table.pairings).toHaveLength(7);
    expect(table.pairings[0]).toEqual({
      teamKeys: expect.any(Array),
      winnerTeamKey: "466.l.100000.t.9",
      isTied: false,
    });
    expect(teamTableSchema.parse(table)).toEqual(table);
  });

  it("reads the current week from the response itself", () => {
    const table = parseWeekTable(fixture("league-current-week"), FETCHED_AT);

    expect(table.scope).toEqual({ kind: "week", week: 8 });
    expect(table.pairings).toHaveLength(7);
  });

  it("rejects a response for a different week than requested", () => {
    expect(() => parseWeekTable(fixture("league-week-1"), FETCHED_AT, 2)).toThrow(
      YahooResponseError
    );
  });
});

describe("what Yahoo leaves out", () => {
  it("treats an absent or malformed stat as unknown, never as zero", () => {
    const response = fixture("league-season");
    const stats = firstSeasonTeam(response).find((part: any) => part.team_stats).team_stats.stats;
    stats.find((entry: any) => entry.stat.stat_id === "12").stat.value = "-";
    stats.find((entry: any) => entry.stat.stat_id === "9004003").stat.value = "n/a";
    const index = stats.findIndex((entry: any) => entry.stat.stat_id === "17");
    stats.splice(index, 1);

    const team = parseSeasonTable(response, FETCHED_AT).teams.find(
      (row) => row.teamKey === "466.l.100000.t.11"
    )!;

    expect(team.totals).toMatchObject({
      pts: null,
      stl: null,
      fgMakes: null,
      fgAttempts: null,
      reb: 1716,
    });
  });

  it("reads a finished league and a hidden manager", () => {
    const response = fixture("league-season");
    response.fantasy_content.league[0].is_finished = 1;
    firstSeasonTeam(response)[0].find((part: any) => part.managers).managers[0].manager.nickname =
      "--hidden--";

    const table = parseSeasonTable(response, FETCHED_AT);

    expect(table.settings.isFinished).toBe(true);
    expect(table.teams.find((row) => row.teamKey === "466.l.100000.t.11")?.managerName).toBeNull();
  });

  it("flags a category that is not one of the standard nine", () => {
    const response = fixture("league-season");
    const stats = response.fantasy_content.league[1].settings[0].stat_categories.stats;
    stats.find((entry: any) => entry.stat.stat_id === 18).stat.stat_id = 99;

    const table = parseSeasonTable(response, FETCHED_AT);

    expect(scoringSupport(table.settings)).toMatchObject({ supported: false });
  });
});

describe("malformed responses fail instead of guessing", () => {
  const broken: [string, (response: any) => void][] = [
    ["no league", (response) => delete response.fantasy_content.league],
    ["no current week", (response) => delete response.fantasy_content.league[0].current_week],
    ["no end week", (response) => delete response.fantasy_content.league[0].end_week],
    ["no standings section", (response) => response.fantasy_content.league.splice(2, 1)],
    ["no settings section", (response) => response.fantasy_content.league.splice(1, 1)],
    ["no team stats", (response) => delete response.fantasy_content.league[2].standings[0].teams],
  ];

  it.each(broken)("rejects %s", (_name, damage) => {
    const response = fixture("league-season");
    damage(response);

    expect(() => parseSeasonTable(response, FETCHED_AT)).toThrow(YahooResponseError);
  });

  it("names the failing paths but not the values", () => {
    const response = fixture("league-season");
    response.fantasy_content.league[0].end_week = "secret-looking-value";

    try {
      parseSeasonTable(response, FETCHED_AT);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(YahooResponseError);
      expect(JSON.stringify((error as YahooResponseError).details)).toContain("end_week");
      expect(JSON.stringify((error as YahooResponseError).details)).not.toContain("secret");
      expect((error as YahooResponseError).code).toBe("YAHOO_UNAVAILABLE");
    }
  });

  it("rejects a matchup without two teams", () => {
    const response = fixture("league-week-1");
    const matchup = response.fantasy_content.league[2].scoreboard["0"].matchups["0"].matchup;
    matchup["0"].teams.count = 1;

    expect(() => parseWeekTable(response, FETCHED_AT, 1)).toThrow(YahooResponseError);
  });
});
