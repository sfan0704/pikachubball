import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseUserLeagues } from "../../../../server/fantasy/user-leagues";
import { YahooResponseError } from "../../../../server/fantasy/yahoo-shapes";

function captured(name: string): unknown {
  return JSON.parse(readFileSync(`tests/backend/fixtures/yahoo/captured/${name}.json`, "utf8"));
}

const GAME = { game_key: "478", code: "nba", season: "2026", is_game_over: 0, is_offseason: 0 };
const LEAGUE = {
  league_key: "478.l.1",
  name: "League One",
  draft_status: "postdraft",
  start_date: "2026-10-20",
  current_week: 3,
  end_week: 21,
};

/** A user-games response with one game holding the given collection. */
function userGames(resource: "teams" | "leagues", items: unknown[], game: object = GAME) {
  const collection = items.length === 0 ? [] : { ...items, count: items.length };
  return {
    fantasy_content: {
      users: {
        0: {
          user: [
            { guid: "guid-1" },
            { games: { 0: { game: [game, { [resource]: collection }] }, count: 1 } },
          ],
        },
        count: 1,
      },
    },
  };
}

function oneLeague(league: object, game: object = GAME, today = "2026-11-01") {
  return parseUserLeagues(
    userGames("teams", [{ team: [[{ team_key: "478.l.1.t.4" }, { name: "Mine" }]] }], game),
    userGames("leagues", [{ league: [{ ...LEAGUE, ...league }] }], game),
    today
  );
}

describe("parseUserLeagues", () => {
  it("lists every league in the recorded account with the user's team and status", () => {
    const leagues = parseUserLeagues(
      captured("user-teams"),
      captured("user-leagues"),
      "2026-10-10"
    );

    expect(leagues).toHaveLength(19);
    expect(leagues.filter((league) => league.status === "finished")).toHaveLength(17);
    expect(leagues.find((league) => league.leagueKey === "478.l.52912")).toEqual({
      leagueKey: "478.l.52912",
      teamKey: "478.l.52912.t.5",
      name: "League-31",
      season: 2026,
      status: "preseason",
    });
  });

  it("returns the league's name, season and the user's team", () => {
    expect(oneLeague({})).toEqual([
      {
        leagueKey: "478.l.1",
        teamKey: "478.l.1.t.4",
        name: "League One",
        season: 2026,
        status: "active",
      },
    ]);
  });

  it.each([
    ["Yahoo marks the league finished", { is_finished: 1 }, GAME],
    ["the current week is past the end week", { current_week: 22 }, GAME],
    ["the game is over", {}, { ...GAME, is_game_over: "1" }],
  ])("is finished when %s", (_case, league, game) => {
    expect(oneLeague(league, game)[0]?.status).toBe("finished");
  });

  it.each([
    ["it hasn't drafted", { draft_status: "predraft" }, GAME, "2026-11-01"],
    ["it starts after today", {}, GAME, "2026-10-19"],
    ["the game is between seasons", {}, { ...GAME, is_offseason: 1 }, "2026-11-01"],
  ])("is preseason when %s", (_case, league, game, today) => {
    expect(oneLeague(league, game, today)[0]?.status).toBe("preseason");
  });

  it("is active from its start date", () => {
    expect(oneLeague({}, GAME, "2026-10-20")[0]?.status).toBe("active");
  });

  it("returns no leagues for a user with no NBA teams", () => {
    expect(
      parseUserLeagues(userGames("teams", []), userGames("leagues", []), "2026-10-10")
    ).toEqual([]);
  });

  it("refuses a team whose league Yahoo didn't list", () => {
    expect(() =>
      parseUserLeagues(
        userGames("teams", [{ team: [[{ team_key: "478.l.9.t.1" }]] }]),
        userGames("leagues", [{ league: [LEAGUE] }]),
        "2026-10-10"
      )
    ).toThrow(YahooResponseError);
  });

  it("refuses a response without the expected structure", () => {
    expect(() =>
      parseUserLeagues({ fantasy_content: {} }, captured("user-leagues"), "2026-10-10")
    ).toThrow(YahooResponseError);
    expect(() => oneLeague({ start_date: "October 20" })).toThrow(YahooResponseError);
  });
});
