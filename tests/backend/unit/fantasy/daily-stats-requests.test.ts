import { describe, expect, it } from "vitest";
import {
  chunkKeys,
  DailyStatsRequests,
} from "../../../../server/fantasy/yahoo/daily-stats-requests";
import {
  YahooRateLimitedError,
  YahooReconnectRequiredError,
  YahooUnavailableError,
} from "../../../../server/fantasy/yahoo/yahoo-request-policy";
import type { YahooRequester } from "../../../../server/fantasy/league-resources";
import { fixedClock } from "../../../support/clock";
import { recordingLogger } from "../../../support/logger";
import { replayYahoo } from "../../../support/yahoo-recordings";

const keys = (count: number) => Array.from({ length: count }, (_, index) => `478.p.${index + 1}`);
const pathFor = (chunk: readonly string[]) =>
  `/league/478.l.100000/players;player_keys=${chunk.join(",")};out=game_log`;

/** A Yahoo stand-in that answers every path with its own path and records each call. */
function echoYahoo(): YahooRequester & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async get(path) {
      calls.push(path);
      return { path };
    },
  };
}

function requestsOver(yahoo: YahooRequester, logger = recordingLogger()) {
  return new DailyStatsRequests(async () => yahoo, logger, fixedClock());
}

describe("chunkKeys", () => {
  it.each([
    [1, [1]],
    [25, [25]],
    [26, [25, 1]],
    [51, [25, 25, 1]],
  ])("splits %i keys into chunks of %j", (count, sizes) => {
    const chunks = chunkKeys(keys(count));

    expect(chunks.map((chunk) => chunk.length)).toEqual(sizes);
    expect(chunks.flat()).toEqual(keys(count));
  });
});

describe("DailyStatsRequests", () => {
  it.each([
    [1, 1],
    [25, 1],
    [26, 2],
    [51, 3],
  ])(
    "makes one call per 25 of %i players and returns bodies in key order",
    async (count, calls) => {
      const yahoo = echoYahoo();

      const bodies = await requestsOver(yahoo).getForPlayers("gameLogs", keys(count), pathFor);

      expect(yahoo.calls).toHaveLength(calls);
      expect(bodies).toEqual(chunkKeys(keys(count)).map((chunk) => ({ path: pathFor(chunk) })));
    }
  );

  it("runs the chunks in parallel", async () => {
    let inFlight = 0;
    let most = 0;
    const yahoo: YahooRequester = {
      async get() {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return {};
      },
    };

    await requestsOver(yahoo).getForPlayers("gameLogs", keys(51), pathFor);

    expect(most).toBe(3);
  });

  it("calls Yahoo once for identical paths in one request, even while the first is in flight", async () => {
    const yahoo = echoYahoo();
    const requests = requestsOver(yahoo);

    const [first, second] = await Promise.all([
      requests.get("draft", "/league/478.l.100000/draftresults"),
      requests.get("draft", "/league/478.l.100000/draftresults"),
    ]);
    await requests.get("draft", "/league/478.l.100000/draftresults");
    await requests.get("weeks", "/game/478/game_weeks");

    expect(first).toBe(second);
    expect(yahoo.calls).toEqual(["/league/478.l.100000/draftresults", "/game/478/game_weeks"]);
  });

  it("does not share calls between requests", async () => {
    const yahoo = echoYahoo();

    await requestsOver(yahoo).get("weeks", "/game/478/game_weeks");
    await requestsOver(yahoo).get("weeks", "/game/478/game_weeks");

    expect(yahoo.calls).toHaveLength(2);
  });

  it("writes one line per Yahoo call naming the resource, never the path", async () => {
    const logger = recordingLogger();
    const requests = requestsOver(echoYahoo(), logger);

    await requests.getForPlayers("gameLogs", keys(26), pathFor);
    await requests.getForPlayers("gameLogs", keys(26), pathFor);

    expect(logger.lines).toHaveLength(2);
    expect(logger.lines.map((line) => line.fields)).toEqual([
      { resource: "gameLogs", outcome: "ok", durationMs: 0 },
      { resource: "gameLogs", outcome: "ok", durationMs: 0 },
    ]);
    expect(JSON.stringify(logger.lines)).not.toContain("478.p.");
  });

  it.each([
    ["rate limiting", new YahooRateLimitedError(30), "YAHOO_RATE_LIMITED"],
    ["an outage", new YahooUnavailableError(), "YAHOO_UNAVAILABLE"],
    ["a revoked grant", new YahooReconnectRequiredError(), "YAHOO_RECONNECT_REQUIRED"],
    ["a missing resource", { response: { status: 404 } }, "NOT_FOUND"],
    ["a rejected key", { response: { status: 400 } }, "NOT_FOUND"],
    ["a refusal", { response: { status: 403 } }, "YAHOO_UNAVAILABLE"],
    ["an unexpected failure", new Error("socket closed"), "YAHOO_UNAVAILABLE"],
  ])("maps %s to %s and logs it", async (_case, failure, code) => {
    const logger = recordingLogger();
    const yahoo: YahooRequester = {
      async get() {
        throw failure;
      },
    };

    await expect(
      requestsOver(yahoo, logger).get("draft", "/league/478.l.100000/draftresults")
    ).rejects.toMatchObject({ code });
    expect(logger.lines).toHaveLength(1);
    expect(logger.lines[0]).toMatchObject({ level: "warn", fields: { outcome: code } });
  });

  it("replays a recording and counts its calls against the budget", async () => {
    const recorded = pathFor([
      "478.p.5432",
      "478.p.5471",
      "478.p.5836",
      "478.p.5840",
      "478.p.3704",
      "478.p.4244",
      "478.p.4472",
      "478.p.4563",
      "478.p.4612",
      "478.p.4614",
      "478.p.4622",
      "478.p.4725",
      "478.p.4840",
      "478.p.4892",
      "478.p.4896",
      "478.p.5007",
      "478.p.5012",
      "478.p.5069",
      "478.p.5161",
      "478.p.5185",
      "478.p.5197",
      "478.p.5292",
      "478.p.5294",
      "478.p.5295",
      "478.p.5318",
    ]).replace("478.l.100000", "478.l.14822");
    const yahoo = replayYahoo({ [recorded]: "daily-stats/d3-game-logs-by-key" });
    const playerKeys = recorded
      .slice(recorded.indexOf("=") + 1, recorded.indexOf(";out"))
      .split(",");

    const [body] = await requestsOver(yahoo).getForPlayers(
      "gameLogs",
      playerKeys,
      (chunk) => `/league/478.l.14822/players;player_keys=${chunk.join(",")};out=game_log`
    );

    expect(yahoo.calls).toEqual([recorded]);
    expect(body).toHaveProperty("fantasy_content.league");
  });

  it("fails a replay for a path that has no recording", async () => {
    const yahoo = replayYahoo({});

    await expect(yahoo.get("/game/478/game_weeks")).rejects.toThrow("No Yahoo recording");
  });
});
