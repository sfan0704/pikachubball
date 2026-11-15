import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { teamTableSchema } from "../../../../shared/api/team-table";
import { scoringSupport, tableCompleteness, weeklyAllPlay } from "../../../../shared/domain";
import { parseSeasonTable, parseWeekTable } from "../../../../server/fantasy/league-tables";
import { defined } from "../../../support/defined";
import { YahooResponseError } from "../../../../server/fantasy/yahoo-shapes";

type Fixture = ReturnType<typeof fixture>;

const FETCHED_AT = "2025-12-11T18:00:00.000Z";

function fixture(name: string) {
  return JSON.parse(readFileSync(`tests/backend/fixtures/yahoo/${name}.json`, "utf8"));
}

/** The team fragments of the first team in a recorded season response. */
function firstSeasonTeam(response: Fixture) {
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
    expect(table.settings.categories.map((category) => category.statId)).toEqual([
      "5",
      "8",
      "10",
      "12",
      "15",
      "16",
      "17",
      "18",
      "19",
    ]);
    expect(table.settings.categories.find((category) => category.statId === "19")?.direction).toBe(
      "lower"
    );
    expect(scoringSupport(table.settings)).toEqual({ supported: true });
  });

  it("reads every team's category values, ratios exact from makes and attempts", () => {
    expect(table.teams).toHaveLength(14);
    expect(table.teams.find((team) => team.teamKey === "466.l.100000.t.11")).toEqual({
      teamKey: "466.l.100000.t.11",
      teamName: "Team 11",
      managerName: "Manager 11",
      categoryValues: {
        "5": 1713 / 3579,
        "8": 889 / 1162,
        "10": 448,
        "12": 4763,
        "15": 1716,
        "16": 1023,
        "17": 313,
        "18": 180,
        "19": 556,
      },
      games: null,
      record: { wins: 36, losses: 27, ties: 0 },
    });
  });

  it("leaves the record unknown when a team has no standings entry", () => {
    const response = fixture("league-season");
    const team = firstSeasonTeam(response);
    team.splice(
      team.findIndex((fragment: object) => "team_standings" in fragment),
      1
    );

    const parsed = parseSeasonTable(response, FETCHED_AT);

    expect(parsed.teams.filter((row) => row.record === null)).toHaveLength(1);
  });

  it("matches the shared API schema and feeds the domain maths", () => {
    expect(teamTableSchema.parse(table)).toEqual(table);
    const allPlay = weeklyAllPlay(
      table.settings.categories,
      table.teams.map((team) => ({ teamKey: team.teamKey, values: team.categoryValues }))
    );
    expect(Object.keys(allPlay)).toHaveLength(14);
    // Every team meets 13 others in 9 categories.
    expect(
      Object.values(allPlay).every(({ total }) => total.wins + total.losses + total.ties === 117)
    ).toBe(true);
  });
});

describe("week table from the scoreboard response", () => {
  it("reads a past week with its matchup pairings", () => {
    const table = parseWeekTable(fixture("league-week-1"), FETCHED_AT, 1);

    expect(table.scope).toEqual({ kind: "week", week: 1 });
    expect(table.teams).toHaveLength(14);
    expect(table.teams.every((team) => team.record === null)).toBe(true);
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
    const stats = firstSeasonTeam(response).find((part: Fixture) => part.team_stats).team_stats
      .stats;
    stats.find((entry: Fixture) => entry.stat.stat_id === "12").stat.value = "-";
    stats.find((entry: Fixture) => entry.stat.stat_id === "9004003").stat.value = "n/a";
    const index = stats.findIndex((entry: Fixture) => entry.stat.stat_id === "17");
    stats.splice(index, 1);

    const team = defined(
      parseSeasonTable(response, FETCHED_AT).teams.find(
        (row) => row.teamKey === "466.l.100000.t.11"
      )
    );

    // FG% falls back to Yahoo's own rounded value when its makes and attempts don't read.
    expect(team.categoryValues).toMatchObject({
      "5": 0.479,
      "12": null,
      "17": null,
      "15": 1716,
    });
  });

  it("reads a finished league and a hidden manager", () => {
    const response = fixture("league-season");
    response.fantasy_content.league[0].is_finished = 1;
    firstSeasonTeam(response)[0].find(
      (part: Fixture) => part.managers
    ).managers[0].manager.nickname = "--hidden--";

    const table = parseSeasonTable(response, FETCHED_AT);

    expect(table.settings.isFinished).toBe(true);
    expect(table.teams.find((row) => row.teamKey === "466.l.100000.t.11")?.managerName).toBeNull();
  });

  it("loads a category it can't build as unavailable, with Yahoo's own value", () => {
    const response = fixture("league-season");
    const stats = response.fantasy_content.league[1].settings[0].stat_categories.stats;
    stats.find((entry: Fixture) => entry.stat.stat_id === 18).stat.stat_id = 1001;
    const teamStats = firstSeasonTeam(response).find((part: Fixture) => part.team_stats).team_stats
      .stats;
    teamStats.find((entry: Fixture) => entry.stat.stat_id === "18").stat.stat_id = "1001";

    const table = parseSeasonTable(response, FETCHED_AT);

    expect(table.settings.categories.find((category) => category.statId === "1001")).toEqual({
      statId: "1001",
      displayName: "BLK",
      direction: "higher",
      makeup: { kind: "unavailable" },
    });
    expect(table.teams[0].categoryValues["1001"]).toBe(180);
    expect(scoringSupport(table.settings)).toEqual({ supported: true });
  });

  it("leaves a category's value unknown when Yahoo sends none", () => {
    const response = fixture("league-season");
    const teamStats = firstSeasonTeam(response).find((part: Fixture) => part.team_stats).team_stats
      .stats;
    teamStats.find((entry: Fixture) => entry.stat.stat_id === "5").stat.value = "-";
    teamStats.find((entry: Fixture) => entry.stat.stat_id === "9004003").stat.value = "-/-";
    teamStats.find((entry: Fixture) => entry.stat.stat_id === "9007006").stat.value = "0/0";

    const team = parseSeasonTable(response, FETCHED_AT).teams[0];

    expect(team.categoryValues["5"]).toBeNull();
    expect(team.categoryValues["8"]).toBeNull();
    expect(team.categoryValues["12"]).toBe(4763);
  });
});

describe("malformed responses fail instead of guessing", () => {
  const broken: [string, (response: Fixture) => void][] = [
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

describe("leagues with their own categories", () => {
  it("builds the standard categories from counting stats and makes over attempts", () => {
    const { categories } = parseSeasonTable(fixture("league-season"), FETCHED_AT).settings;

    expect(categories.find((category) => category.statId === "5")?.makeup).toEqual({
      kind: "ratio",
      topStatId: "4",
      bottomStatId: "3",
    });
    expect(categories.find((category) => category.statId === "12")?.makeup).toEqual({
      kind: "counting",
    });
    expect(categories.some((category) => category.statId === "9004003")).toBe(false);
  });

  it("loads a 12-team league with ten categories, two of them lower is better", () => {
    const table = parseSeasonTable(fixture("league-season-12-teams-10-categories"), FETCHED_AT);

    expect(scoringSupport(table.settings)).toEqual({ supported: true });
    expect(table.teams).toHaveLength(12);
    expect(
      table.settings.categories.map(({ displayName, direction }) => [displayName, direction])
    ).toEqual([
      ["FG%", "higher"],
      ["FT%", "higher"],
      ["3PT%", "higher"],
      ["PTS", "higher"],
      ["REB", "higher"],
      ["AST", "higher"],
      ["ST", "higher"],
      ["BLK", "higher"],
      ["TO", "lower"],
      ["PF", "lower"],
    ]);
    expect(table.settings.categories[2]).toMatchObject({
      statId: "11",
      makeup: { kind: "ratio", topStatId: "10", bottomStatId: "9" },
    });
    expect(table.settings.categories[9]).toMatchObject({
      statId: "21",
      makeup: { kind: "counting" },
    });
    expect(table.teams[0].categoryValues).toMatchObject({ "11": 441 / 1279, "21": 1171 });
    expect(teamTableSchema.parse(table)).toEqual(table);
  });

  it("loads an 8-team league with eight categories and no free throws or turnovers", () => {
    const table = parseSeasonTable(fixture("league-season-8-teams-8-categories"), FETCHED_AT);

    expect(scoringSupport(table.settings)).toEqual({ supported: true });
    expect(table.teams).toHaveLength(8);
    expect(
      table.settings.categories.map(({ displayName, direction }) => [displayName, direction])
    ).toEqual([
      ["FG%", "higher"],
      ["3PTM", "higher"],
      ["PTS", "higher"],
      ["REB", "higher"],
      ["AST", "higher"],
      ["ST", "higher"],
      ["BLK", "higher"],
      ["A/T", "higher"],
    ]);
    expect(table.settings.categories[7].makeup).toEqual({
      kind: "ratio",
      topStatId: "16",
      bottomStatId: "19",
    });
    expect(table.teams[0].categoryValues["20"]).toBe(1.88);
    expect(tableCompleteness(table)).toBe("complete");
  });
});
