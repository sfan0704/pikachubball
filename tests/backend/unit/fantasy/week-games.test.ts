import { describe, expect, it } from "vitest";
import { teamTableSchema } from "../../../../shared/api/team-table";
import { gamesPlayed, type TeamTable } from "../../../../shared/domain";
import { YahooFantasyDataSource } from "../../../../server/fantasy/fantasy-data-source";
import { YahooLeagueResources } from "../../../../server/fantasy/league-resources";
import { parseSeasonTable, parseWeekTable } from "../../../../server/fantasy/league-tables";
import { YahooResponseError } from "../../../../server/fantasy/yahoo-shapes";
import { replayYahoo, yahooRecording } from "../../../support/yahoo-recordings";

const LEAGUE = "478.l.14822";
const NOW = Date.parse("2026-11-08T03:00:00.000Z");
const WEEK_2 = "daily-stats/d1-week-2-final";
const WEEK_3 = "daily-stats/d1-week-3-midweek";

function source(recordings: Record<string, string>) {
  const yahoo = replayYahoo(recordings);
  const resources = new YahooLeagueResources(async () => yahoo);
  return { yahoo, data: new YahooFantasyDataSource(resources, { now: () => NOW }) };
}

/** Deletes the first `key` found in a Yahoo body, as if Yahoo had left it out. */
function dropFirst(node: unknown, key: string): boolean {
  if (typeof node !== "object" || node === null) {
    return false;
  }
  if (key in node) {
    return Reflect.deleteProperty(node, key);
  }
  return Object.values(node).some((value) => dropFirst(value, key));
}

function gamesOf(table: TeamTable, team: number) {
  return table.teams.find((row) => row.teamKey === `${LEAGUE}.t.${team}`)?.games;
}

describe("D1 games left from the week table", () => {
  it("reads a finished week: everything completed, nothing left", async () => {
    const { yahoo, data } = source({
      [`/league/${LEAGUE};out=settings/scoreboard;week=2`]: WEEK_2,
    });

    const table = await data.getWeek(LEAGUE, 2);

    expect(yahoo.calls).toHaveLength(1);
    expect(gamesOf(table, 10)).toEqual({ remaining: 0, live: 0, completed: 44 });
    expect(gamesOf(table, 9)).toEqual({ remaining: 0, live: 0, completed: 41 });
    expect(table.teams.every((row) => row.games?.remaining === 0)).toBe(true);
    expect(teamTableSchema.parse(table)).toEqual(table);
  });

  it("reads a week in progress with remaining, live and completed games", async () => {
    const { yahoo, data } = source({ [`/league/${LEAGUE};out=settings,scoreboard`]: WEEK_3 });

    const table = await data.getWeek(LEAGUE, "current");

    expect(yahoo.calls).toEqual([`/league/${LEAGUE};out=settings,scoreboard`]);
    expect(table.scope).toEqual({ kind: "week", week: 3 });
    expect(gamesOf(table, 10)).toEqual({ remaining: 7, live: 1, completed: 31 });
    expect(gamesOf(table, 5)).toEqual({ remaining: 6, live: 1, completed: 30 });
    expect(gamesOf(table, 9)).toEqual({ remaining: 11, live: 2, completed: 31 });
    expect(gamesPlayed({ remaining: 7, live: 1, completed: 31 })).toEqual({
      played: 32,
      total: 39,
    });
    expect(teamTableSchema.parse(table)).toEqual(table);
  });

  it("leaves a team's games unknown when Yahoo's table doesn't carry them", () => {
    const response = yahooRecording(WEEK_3);
    expect(dropFirst(response, "team_remaining_games")).toBe(true);

    const table = parseWeekTable(response, new Date(NOW).toISOString());

    expect(gamesOf(table, 1)).toBeNull();
    expect(gamesOf(table, 3)).toEqual({ remaining: 12, live: 1, completed: 29 });
  });

  it("rejects a count that isn't a whole number rather than guessing", () => {
    const text = JSON.stringify(yahooRecording(WEEK_2));
    const broken: unknown = JSON.parse(
      text.replace('"completed_games":44', '"completed_games":-1')
    );

    expect(() => parseWeekTable(broken, new Date(NOW).toISOString(), 2)).toThrow(
      YahooResponseError
    );
  });

  it("never gives the season table week games", () => {
    const table = parseSeasonTable(yahooRecording("league-season"), new Date(NOW).toISOString());

    expect(table.teams.every((row) => row.games === null)).toBe(true);
  });
});
