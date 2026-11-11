import { describe, expect, it } from "vitest";
import {
  transactionsResponseSchema,
  draftResponseSchema,
} from "../../../../shared/api/daily-stats";
import { nbaDateOf } from "../../../../shared/domain/nba-date";
import { YahooDailyStatsSource } from "../../../../server/fantasy/yahoo-daily-stats-source";
import { DailyStatsRequests } from "../../../../server/fantasy/yahoo/daily-stats-requests";
import { fixedClock } from "../../../support/clock";
import { silentLogger } from "../../../support/dependencies";
import { replayYahoo } from "../../../support/yahoo-recordings";

const LEAGUE = "478.l.14822";
const TRADING_TEAM = `${LEAGUE}.t.7`;
const OWN_TEAM = `${LEAGUE}.t.10`;
const FETCHED_AT = "2026-11-11T01:05:00.000Z";

const transactionsPath = (teamKey: string) =>
  `/league/${LEAGUE}/transactions;types=add,drop,trade;team_key=${teamKey}`;
const DRAFT_PATH = `/league/${LEAGUE}/draftresults`;

function sourceOver(recordings: Record<string, string | object>) {
  const yahoo = replayYahoo(recordings);
  const source = new YahooDailyStatsSource(
    new DailyStatsRequests(async () => yahoo, silentLogger, fixedClock())
  );
  return { yahoo, source };
}

/** A transactions body with the given entries, shaped as Yahoo writes it. */
function transactionsBody(transactions: unknown): object {
  return { fantasy_content: { league: [{ league_key: LEAGUE }, { transactions }] } };
}

describe("YahooDailyStatsSource transactions (D7)", () => {
  it("keeps only a team's successful moves, newest first, in one call", async () => {
    const { yahoo, source } = sourceOver({
      [transactionsPath(TRADING_TEAM)]: "daily-stats/d7-transactions-trading-team",
    });

    const result = await source.getTransactions(LEAGUE, TRADING_TEAM);

    expect(yahoo.calls).toEqual([transactionsPath(TRADING_TEAM)]);
    expect(() =>
      transactionsResponseSchema.parse({ ...result, fetchedAt: FETCHED_AT })
    ).not.toThrow();
    // 18 recorded rows, one of them a vetoed trade.
    expect(result.transactions).toHaveLength(17);
    expect(result.transactions.map((move) => move.transactionKey)).not.toContain(`${LEAGUE}.tr.27`);
    const times = result.transactions.map((move) => Date.parse(move.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("reads adds as lists and drops as single objects", async () => {
    const { source } = sourceOver({
      [transactionsPath(TRADING_TEAM)]: "daily-stats/d7-transactions-trading-team",
    });

    const { transactions } = await source.getTransactions(LEAGUE, TRADING_TEAM);

    expect(transactions[0]).toEqual({
      transactionKey: `${LEAGUE}.tr.179`,
      kind: "addDrop",
      at: "2026-11-10T08:20:56.000Z",
      waiverBid: null,
      players: [
        {
          playerKey: "478.p.10282",
          move: "add",
          from: { kind: "freeAgents" },
          to: { kind: "team", teamKey: TRADING_TEAM },
        },
        {
          playerKey: "478.p.10607",
          move: "drop",
          from: { kind: "team", teamKey: TRADING_TEAM },
          to: { kind: "waivers" },
        },
      ],
    });
  });

  it("names both teams of a trade, whichever side made the offer", async () => {
    const { source } = sourceOver({
      [transactionsPath(TRADING_TEAM)]: "daily-stats/d7-transactions-trading-team",
    });

    const { transactions } = await source.getTransactions(LEAGUE, TRADING_TEAM);
    const trades = transactions.filter((move) => move.kind === "trade");

    expect(trades.map((move) => move.transactionKey)).toEqual([
      `${LEAGUE}.tr.109`,
      `${LEAGUE}.tr.29`,
      `${LEAGUE}.tr.23`,
      `${LEAGUE}.tr.22`,
    ]);
    // tr.23 was offered by another team; the team still receives a player.
    expect(trades[2]?.players).toContainEqual({
      playerKey: "478.p.6450",
      move: "trade",
      from: { kind: "team", teamKey: `${LEAGUE}.t.6` },
      to: { kind: "team", teamKey: TRADING_TEAM },
    });
  });

  it("carries the FAAB bid of a waiver claim and none on free-agent adds", async () => {
    const { source } = sourceOver({
      [transactionsPath(OWN_TEAM)]: "daily-stats/d7-transactions-own-team",
    });

    const { transactions } = await source.getTransactions(LEAGUE, OWN_TEAM);
    const claim = transactions.find((move) => move.transactionKey === `${LEAGUE}.tr.84`);

    expect(transactions).toHaveLength(10);
    expect(claim?.waiverBid).toBe(10);
    expect(claim?.players[0]?.from).toEqual({ kind: "waivers" });
    expect(transactions.filter((move) => move.waiverBid !== null)).toHaveLength(1);
  });

  it("keeps the exact moment so a late-evening move falls on its US Eastern date", async () => {
    const { source } = sourceOver({
      [transactionsPath(TRADING_TEAM)]: "daily-stats/d7-transactions-trading-team",
    });

    const { transactions } = await source.getTransactions(LEAGUE, TRADING_TEAM);
    const lateMove = transactions.find((move) => move.transactionKey === `${LEAGUE}.tr.117`);

    expect(lateMove?.at).toBe("2026-10-31T02:42:50.000Z");
    expect(nbaDateOf(Date.parse(lateMove?.at ?? ""))).toBe("2026-10-30");
  });

  it("leaves out other teams' moves when Yahoo sends a wider feed", async () => {
    const { source } = sourceOver({
      [transactionsPath(OWN_TEAM)]: "daily-stats/d7-transactions-whole-league",
    });
    const { source: narrow } = sourceOver({
      [transactionsPath(OWN_TEAM)]: "daily-stats/d7-transactions-own-team",
    });

    const wide = await source.getTransactions(LEAGUE, OWN_TEAM);
    const own = await narrow.getTransactions(LEAGUE, OWN_TEAM);

    // The whole-league feed was recorded 3 days earlier, so it has the older part of the same list.
    const ownKeys = own.transactions.map((move) => move.transactionKey);
    expect(wide.transactions.map((move) => move.transactionKey)).toEqual(
      ownKeys.filter((key) => wide.transactions.some((move) => move.transactionKey === key))
    );
    expect(wide.transactions.length).toBeGreaterThan(0);
  });

  it("answers a team with no moves with an empty list", async () => {
    const { source } = sourceOver({ [transactionsPath(OWN_TEAM)]: transactionsBody([]) });

    await expect(source.getTransactions(LEAGUE, OWN_TEAM)).resolves.toEqual({
      teamKey: OWN_TEAM,
      transactions: [],
    });
  });

  it("refuses a successful move of a kind it doesn't know", async () => {
    const body = transactionsBody({
      count: 1,
      "0": {
        transaction: [
          {
            transaction_key: `${LEAGUE}.tr.1`,
            type: "commish",
            status: "successful",
            timestamp: "1",
          },
        ],
      },
    });
    const { source } = sourceOver({ [transactionsPath(OWN_TEAM)]: body });

    await expect(source.getTransactions(LEAGUE, OWN_TEAM)).rejects.toMatchObject({
      code: "YAHOO_UNAVAILABLE",
    });
  });
});

describe("YahooDailyStatsSource draft results (D8)", () => {
  it("reads an auction's 182 picks with their prices in one call", async () => {
    const { yahoo, source } = sourceOver({ [DRAFT_PATH]: "daily-stats/d8-draft-results" });

    const draft = await source.getDraft(LEAGUE);

    expect(yahoo.calls).toEqual([DRAFT_PATH]);
    expect(() => draftResponseSchema.parse({ ...draft, fetchedAt: FETCHED_AT })).not.toThrow();
    expect(draft.isAuction).toBe(true);
    expect(draft.picks).toHaveLength(182);
    expect(draft.picks[0]).toEqual({
      pick: 1,
      round: 1,
      teamKey: `${LEAGUE}.t.2`,
      playerKey: "478.p.10592",
      cost: 21,
    });
    expect(draft.picks.every((pick) => pick.cost !== null)).toBe(true);
  });

  it("reads a snake draft's rounds without prices and skips picks not yet made", async () => {
    const body = {
      fantasy_content: {
        league: [
          { league_key: LEAGUE },
          {
            draft_results: {
              count: 3,
              "0": {
                draft_result: {
                  pick: 2,
                  round: 1,
                  team_key: `${LEAGUE}.t.2`,
                  player_key: "478.p.2",
                },
              },
              "1": {
                draft_result: {
                  pick: 1,
                  round: 1,
                  team_key: `${LEAGUE}.t.1`,
                  player_key: "478.p.1",
                },
              },
              "2": { draft_result: { pick: 3, round: 2 } },
            },
          },
        ],
      },
    };
    const { source } = sourceOver({ [DRAFT_PATH]: body });

    await expect(source.getDraft(LEAGUE)).resolves.toEqual({
      isAuction: false,
      picks: [
        { pick: 1, round: 1, teamKey: `${LEAGUE}.t.1`, playerKey: "478.p.1", cost: null },
        { pick: 2, round: 1, teamKey: `${LEAGUE}.t.2`, playerKey: "478.p.2", cost: null },
      ],
    });
  });
});
