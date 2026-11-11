import { describe, expect, it } from "vitest";
import { YahooDailyStatsSource } from "../../../../server/fantasy/yahoo-daily-stats-source";
import { DailyStatsRequests } from "../../../../server/fantasy/yahoo/daily-stats-requests";
import { fixedClock } from "../../../support/clock";
import { silentLogger } from "../../../support/dependencies";
import { replayYahoo } from "../../../support/yahoo-recordings";

const LEAGUE = "478.l.100000";

function sourceOver() {
  const yahoo = replayYahoo({});
  const source = new YahooDailyStatsSource(
    new DailyStatsRequests(async () => yahoo, silentLogger, fixedClock())
  );
  return { yahoo, source };
}

describe("YahooDailyStatsSource key checks", () => {
  it.each([
    ["a malformed league", (s: YahooDailyStatsSource) => s.getWeeks("478.l.x")],
    [
      "a team of another league",
      (s: YahooDailyStatsSource) => s.getTransactions(LEAGUE, "478.l.200000.t.1"),
    ],
    [
      "a malformed team",
      (s: YahooDailyStatsSource) => s.getTeamDay(LEAGUE, `${LEAGUE}.t.x`, "2026-11-10"),
    ],
    [
      "a malformed date",
      (s: YahooDailyStatsSource) => s.getTeamDay(LEAGUE, `${LEAGUE}.t.1`, "11/10/2026"),
    ],
    [
      "a player from another season",
      (s: YahooDailyStatsSource) => s.getGameLogs(LEAGUE, ["478.p.1", "466.p.2"]),
    ],
    [
      "a malformed player",
      (s: YahooDailyStatsSource) => s.getPlayerStats(LEAGUE, "season", ["478.p.1;out=x"]),
    ],
    ["no players", (s: YahooDailyStatsSource) => s.getGameLogs(LEAGUE, [])],
  ])("rejects %s with VALIDATION_ERROR and no Yahoo call", async (_case, read) => {
    const { yahoo, source } = sourceOver();

    await expect(read(source)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(yahoo.calls).toEqual([]);
  });

  it.each([
    ["game logs", (s: YahooDailyStatsSource) => s.getGameLogs(LEAGUE, ["478.p.1"])],
    ["player totals", (s: YahooDailyStatsSource) => s.getPlayerStats(LEAGUE, "last7", ["478.p.1"])],
    [
      "player list",
      (s: YahooDailyStatsSource) =>
        s.listPlayers(LEAGUE, { status: "available", sort: "actualRank", start: 0 }),
    ],
    ["schedule", (s: YahooDailyStatsSource) => s.getSchedule(LEAGUE)],
  ])("answers %s NOT_FOUND until its dataset is connected", async (_dataset, read) => {
    const { yahoo, source } = sourceOver();

    await expect(read(source)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(yahoo.calls).toEqual([]);
  });
});
