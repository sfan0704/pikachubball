import { describe, expect, it } from "vitest";
import { latestAcquisition } from "../../../../shared/domain";
import { YahooDailyStatsSource } from "../../../../server/fantasy/yahoo-daily-stats-source";
import { DailyStatsRequests } from "../../../../server/fantasy/yahoo/daily-stats-requests";
import { fixedClock } from "../../../support/clock";
import { silentLogger } from "../../../support/dependencies";
import { replayYahoo, yahooRecording } from "../../../support/yahoo-recordings";

const LEAGUE = "478.l.14822";
const DRAFT_PATH = `/league/${LEAGUE}/draftresults`;
const transactionsPath = (teamKey: string) =>
  `/league/${LEAGUE}/transactions;types=add,drop,trade;team_key=${teamKey}`;

/** Every team's rostered players at the FAN-96 capture (2026-11-07), from its teams/roster recording. */
const rostered = yahooRecording("daily-stats/fan96-rostered-players") as Record<string, string[]>;
const teamKeys = Object.keys(rostered);

/*
 * FAN-96 checked the latest-acquisition rule by hand over the same capture:
 * 201 rostered players, 143 drafted, 48 free agent, 6 trade, 4 waiver claim,
 * 0 unknown. The whole-league feed stands in for each team's call; the source
 * narrows it to the team as it would Yahoo's answer.
 */
describe("latest acquisition over the FAN-96 recordings", () => {
  it("matches FAN-96's counts for every rostered player with no contradictions", async () => {
    const yahoo = replayYahoo({
      [DRAFT_PATH]: "daily-stats/d8-draft-results",
      ...Object.fromEntries(
        teamKeys.map((teamKey) => [
          transactionsPath(teamKey),
          "daily-stats/d7-transactions-whole-league",
        ])
      ),
    });
    const source = new YahooDailyStatsSource(
      new DailyStatsRequests(async () => yahoo, silentLogger, fixedClock())
    );

    const draft = await source.getDraft(LEAGUE);
    const counts: Record<string, number> = {};
    for (const teamKey of teamKeys) {
      const { transactions } = await source.getTransactions(LEAGUE, teamKey);
      for (const playerKey of rostered[teamKey] ?? []) {
        const { kind } = latestAcquisition(playerKey, teamKey, transactions, draft);
        counts[kind] = (counts[kind] ?? 0) + 1;
      }
    }

    expect(teamKeys).toHaveLength(14);
    expect(counts).toEqual({ auction: 143, freeAgent: 48, trade: 6, waivers: 4 });
    // One draft call for the league and one transactions call per team.
    expect(yahoo.calls).toHaveLength(1 + teamKeys.length);
  });
});
