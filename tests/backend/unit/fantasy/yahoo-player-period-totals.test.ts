import { describe, expect, it } from "vitest";
import { measured, missingLine, perGameAverages } from "../../../../shared/domain";
import { YahooDailyStatsSource } from "../../../../server/fantasy/yahoo-daily-stats-source";
import { DailyStatsRequests } from "../../../../server/fantasy/yahoo/daily-stats-requests";
import { fixedClock } from "../../../support/clock";
import { silentLogger } from "../../../support/dependencies";
import { replayYahoo } from "../../../support/yahoo-recordings";

const LEAGUE = "478.l.14822";
/** The FAN-93 sample players, in the order they were recorded. */
const RECORDED = ["478.p.10454", "478.p.6417", "478.p.6165"];
const recordedPath = (type: string) =>
  `/players;player_keys=${RECORDED.join(",")}/stats;type=${type}`;

const RECORDINGS = {
  [recordedPath("season")]: "daily-stats/d4-players-season",
  [recordedPath("lastweek")]: "daily-stats/d4-players-lastweek",
  [recordedPath("lastmonth")]: "daily-stats/d4-players-lastmonth",
};

/** A played period: GP, FGA, FGM, FTA, FTM, 3PM, PTS, REB, AST, ST, BLK, TO. */
const PLAYED = {
  "0": "2",
  "2": "60",
  "3": "20",
  "4": "10",
  "5": ".500",
  "6": "4",
  "7": "3",
  "8": ".750",
  "10": "2",
  "12": "25",
  "15": "8",
  "16": "6",
  "17": "2",
  "18": "1",
  "19": "3",
};

/** How Yahoo writes a period without games: GP 0, zeros and `-` percentages. */
const NO_GAMES = { ...PLAYED, "0": "0", "5": "-", "8": "-" };

/** A game-context players body, shaped as Yahoo sends it, with the given stats per player. */
function playersBody(players: ReadonlyArray<readonly [string, Record<string, string>]>) {
  const entries = players.map(([playerKey, stats]) => ({
    player: [
      [{ player_key: playerKey }, { name: { full: "Scrubbed" } }, []],
      {
        player_stats: {
          "0": { coverage_type: "lastweek" },
          stats: Object.entries(stats).map(([stat_id, value]) => ({ stat: { stat_id, value } })),
        },
      },
    ],
  }));
  return {
    fantasy_content: {
      players: { count: entries.length, ...Object.fromEntries(entries.entries()) },
    },
  };
}

function sourceOver(recordings: Readonly<Record<string, string | object>>) {
  const yahoo = replayYahoo(recordings);
  const source = new YahooDailyStatsSource(
    new DailyStatsRequests(async () => yahoo, silentLogger, fixedClock())
  );
  return { yahoo, source };
}

const keys = (count: number) => Array.from({ length: count }, (_, index) => `478.p.${index + 1}`);

describe("YahooDailyStatsSource player totals (D4)", () => {
  it("reads season totals and games played from the FAN-93 recording in one call", async () => {
    const { yahoo, source } = sourceOver(RECORDINGS);

    const stats = await source.getPlayerStats(LEAGUE, "season", RECORDED);

    expect(yahoo.calls).toEqual([recordedPath("season")]);
    expect(stats.period).toBe("season");
    expect(stats.players.map(({ playerKey, gamesPlayed }) => [playerKey, gamesPlayed])).toEqual([
      ["478.p.10454", 9],
      ["478.p.6417", 8],
      ["478.p.6165", 9],
    ]);
    expect(stats.players[0].line).toEqual({
      fg: measured({ makes: 48, attempts: 103 }),
      ft: measured({ makes: 7, attempts: 11 }),
      tpm: measured(16),
      pts: measured(119),
      reb: measured(59),
      ast: measured(26),
      stl: measured(13),
      blk: measured(4),
      to: measured(11),
    });
  });

  it("reproduces Yahoo's per-game values for the recorded season", async () => {
    const { source } = sourceOver(RECORDINGS);

    const stats = await source.getPlayerStats(LEAGUE, "season", RECORDED);
    const averages = perGameAverages(stats.players[1]);

    // Yahoo's own averages for 478.p.6417 (FAN-93 average_season): 17.4 PTS, 5.8 AST, .409 FG%, .848 FT%.
    expect(averages.pts).toBeCloseTo(139 / 8);
    expect(averages.ast).toBeCloseTo(46 / 8);
    expect(averages.fgPct).toBeCloseTo(0.409, 3);
    expect(averages.ftPct).toBeCloseTo(0.848, 3);
  });

  it.each([
    ["last7", "lastweek", [4, 3, 4]],
    ["last30", "lastmonth", [9, 8, 9]],
  ] as const)("asks Yahoo for %s as type=%s", async (period, type, gamesPlayed) => {
    const { yahoo, source } = sourceOver(RECORDINGS);

    const stats = await source.getPlayerStats(LEAGUE, period, RECORDED);

    expect(yahoo.calls).toEqual([recordedPath(type)]);
    expect(stats.period).toBe(period);
    expect(stats.players.map((player) => player.gamesPlayed)).toEqual(gamesPlayed);
  });

  it("reads GP 0 as did not play, which has no per-game values", async () => {
    const path = "/players;player_keys=478.p.1,478.p.2/stats;type=lastweek";
    const { source } = sourceOver({
      [path]: playersBody([
        ["478.p.1", NO_GAMES],
        ["478.p.2", PLAYED],
      ]),
    });

    const stats = await source.getPlayerStats(LEAGUE, "last7", ["478.p.1", "478.p.2"]);

    expect(stats.players[0]).toEqual({
      playerKey: "478.p.1",
      gamesPlayed: 0,
      line: missingLine("didNotPlay"),
    });
    expect(Object.values(perGameAverages(stats.players[0]))).toEqual(Array(9).fill(null));
    expect(perGameAverages(stats.players[1]).pts).toBe(12.5);
  });

  it("makes one call per 25 players, both Matchup teams in two", async () => {
    const players = keys(30);
    const pathFor = (chunk: string[]) =>
      `/players;player_keys=${chunk.join(",")}/stats;type=season`;
    const bodyFor = (chunk: string[]) =>
      playersBody(chunk.map((key) => [key, PLAYED] as const).reverse());
    const { yahoo, source } = sourceOver({
      [pathFor(players.slice(0, 25))]: bodyFor(players.slice(0, 25)),
      [pathFor(players.slice(25))]: bodyFor(players.slice(25)),
    });

    const stats = await source.getPlayerStats(LEAGUE, "season", players);

    expect(yahoo.calls).toHaveLength(2);
    expect(stats.players.map((player) => player.playerKey)).toEqual(players);
  });

  it("answers NOT_FOUND when Yahoo leaves out a player", async () => {
    const path = "/players;player_keys=478.p.1,478.p.2/stats;type=season";
    const { source } = sourceOver({ [path]: playersBody([["478.p.1", PLAYED]]) });

    await expect(
      source.getPlayerStats(LEAGUE, "season", ["478.p.1", "478.p.2"])
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each([
    ["more makes than attempts", { ...PLAYED, "4": "21" }],
    [
      "a missing category",
      Object.fromEntries(Object.entries(PLAYED).filter(([id]) => id !== "12")),
    ],
    ["a total that isn't a whole number", { ...PLAYED, "12": "-" }],
    ["no games played", Object.fromEntries(Object.entries(PLAYED).filter(([id]) => id !== "0"))],
  ])("answers YAHOO_UNAVAILABLE for %s", async (_case, stats) => {
    const path = "/players;player_keys=478.p.1/stats;type=season";
    const { source } = sourceOver({ [path]: playersBody([["478.p.1", stats]]) });

    await expect(source.getPlayerStats(LEAGUE, "season", ["478.p.1"])).rejects.toMatchObject({
      code: "YAHOO_UNAVAILABLE",
    });
  });
});
