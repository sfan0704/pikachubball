import { describe, expect, it } from "vitest";
import { liveSignal, measured, missingLine } from "../../../../shared/domain";
import { YahooDailyStatsSource } from "../../../../server/fantasy/yahoo-daily-stats-source";
import { DailyStatsRequests } from "../../../../server/fantasy/yahoo/daily-stats-requests";
import {
  parseGameLogPlayers,
  type GameLogPlayer,
} from "../../../../server/fantasy/yahoo/game-log-parser";
import { fixedClock } from "../../../support/clock";
import { silentLogger } from "../../../support/dependencies";
import { replayYahoo, yahooRecording } from "../../../support/yahoo-recordings";

const LEAGUE = "478.l.14822";
const RECORDING = "daily-stats/d3-game-logs-by-key";
/** The 25 players of the FAN-102 recording, in the order they were asked for. */
const RECORDED_KEYS = [
  "478.p.5432", "478.p.5471", "478.p.5836", "478.p.5840", "478.p.3704",
  "478.p.4244", "478.p.4472", "478.p.4563", "478.p.4612", "478.p.4614",
  "478.p.4622", "478.p.4725", "478.p.4840", "478.p.4892", "478.p.4896",
  "478.p.5007", "478.p.5012", "478.p.5069", "478.p.5161", "478.p.5185",
  "478.p.5197", "478.p.5292", "478.p.5294", "478.p.5295", "478.p.5318",
]; // prettier-ignore

function pathFor(keys: readonly string[]): string {
  return `/league/${LEAGUE}/players;player_keys=${keys.join(",")};out=game_log`;
}

/** A Yahoo player block as recorded: `{ player: [identity fragments, { game_log }] }`. */
type RecordedPlayer = { player: [Record<string, unknown>[], { game_log: unknown[] }] };
type RecordedEntry = {
  game_log_stats: Record<string, unknown> & { games: { game: Record<string, unknown> }[] };
};

/** A copy of the recording that a test can change. */
function recordedBody() {
  const body = JSON.parse(JSON.stringify(yahooRecording(RECORDING))) as {
    fantasy_content: { league: [unknown, { players: Record<string, unknown> }] };
  };
  return { body, players: body.fantasy_content.league[1].players };
}

function entriesOf(player: RecordedPlayer): RecordedEntry[] {
  return (player.player[1].game_log[1] as { game_log_stats_collection: RecordedEntry[] })
    .game_log_stats_collection;
}

/** Sets a game's status text, as Yahoo writes it on the entry and the game. */
function setStatus(entry: RecordedEntry, status: string, live: 0 | 1): void {
  entry.game_log_stats.status = status;
  entry.game_log_stats.games[0].game.status = status;
  entry.game_log_stats.games[0].game.is_game_live = live;
}

/** Sets the status of the first recorded player's game on the capture date (Knicks vs Bucks). */
function setTonight(players: Record<string, unknown>, status: string, live: 0 | 1): void {
  const tonight = entriesOf(players["0"] as RecordedPlayer).find(
    (entry) => entry.game_log_stats.date === "2026-11-10"
  );
  if (tonight === undefined) {
    throw new Error("The recording has no Knicks game on 2026-11-10");
  }
  setStatus(tonight, status, live);
}

function sourceOver(recordings: Record<string, string | object>) {
  const yahoo = replayYahoo(recordings);
  const source = new YahooDailyStatsSource(
    new DailyStatsRequests(async () => yahoo, silentLogger, fixedClock())
  );
  return { yahoo, source };
}

function gameOn(player: GameLogPlayer | undefined, date: string) {
  return player?.games.find((game) => game.date === date);
}

describe("Yahoo game logs (D3) on the FAN-102 recording", () => {
  it("reads all 25 players in one call, in the order asked for", async () => {
    const { yahoo, source } = sourceOver({ [pathFor(RECORDED_KEYS)]: RECORDING });

    const logs = await source.getGameLogs(LEAGUE, RECORDED_KEYS);

    expect(yahoo.calls).toEqual([pathFor(RECORDED_KEYS)]);
    expect(logs.players.map((player) => player.playerKey)).toEqual(RECORDED_KEYS);
    expect(logs.players[0]).toMatchObject({ playerKey: "478.p.5432", nbaTeam: "NYK" });
  });

  it("parses scheduled, live and final games from the player's side", async () => {
    const { source } = sourceOver({ [pathFor(RECORDED_KEYS)]: RECORDING });
    const logs = await source.getGameLogs(LEAGUE, RECORDED_KEYS);
    const [knicks, bucks] = logs.players;

    expect(gameOn(knicks, "2026-11-15")).toEqual({
      gameId: "2026111528",
      date: "2026-11-15",
      opponent: "TOR",
      isHome: false,
      // From start_time; Yahoo's "3:00 pm" is the account's time zone and is never read.
      state: { kind: "scheduled", tipOff: "2026-11-15T23:00:00.000Z" },
      minutes: { kind: "notYetPlayed" },
      line: missingLine("notYetPlayed"),
    });
    expect(gameOn(knicks, "2026-11-10")).toEqual({
      gameId: "2026111018",
      date: "2026-11-10",
      opponent: "MIL",
      isHome: true,
      state: {
        kind: "live",
        tipOff: "2026-11-11T00:30:00.000Z",
        progress: { kind: "clock", period: 1, clock: "1:17", ownScore: 23, opponentScore: 18 },
      },
      minutes: { kind: "value", value: 7 + 55 / 60 },
      line: {
        fg: measured({ makes: 2, attempts: 4 }),
        ft: measured({ makes: 1, attempts: 2 }),
        tpm: measured(0),
        pts: measured(5),
        reb: measured(5),
        ast: measured(1),
        stl: measured(0),
        blk: measured(1),
        to: measured(2),
      },
    });
    expect(gameOn(bucks, "2026-11-10")?.state).toMatchObject({
      progress: { ownScore: 18, opponentScore: 23 },
    });
    expect(gameOn(knicks, "2026-11-07")).toEqual({
      gameId: "2026110705",
      date: "2026-11-07",
      opponent: "CLE",
      isHome: false,
      state: {
        kind: "final",
        tipOff: "2026-11-08T01:00:00.000Z",
        result: "W",
        ownScore: 109,
        opponentScore: 97,
      },
      minutes: { kind: "value", value: 34 },
      line: {
        fg: measured({ makes: 11, attempts: 21 }),
        ft: measured({ makes: 5, attempts: 5 }),
        tpm: measured(2),
        pts: measured(29),
        reb: measured(13),
        ast: measured(3),
        stl: measured(2),
        blk: measured(0),
        to: measured(0),
      },
    });
  });

  it("tells a final the player sat out from a game that tipped off but isn't flagged live", async () => {
    const { source } = sourceOver({ [pathFor(RECORDED_KEYS)]: RECORDING });
    const logs = await source.getGameLogs(LEAGUE, RECORDED_KEYS);
    const games = logs.players.flatMap((player) => player.games);

    const satOut = games.filter(
      (game) => game.state.kind === "final" && game.minutes.kind === "didNotPlay"
    );
    expect(satOut).toHaveLength(23);
    // A sat-out final's line is "did not play" in every category, never a line of zeros.
    expect(new Set(satOut.map((game) => JSON.stringify(game.line)))).toEqual(
      new Set([JSON.stringify(missingLine("didNotPlay"))])
    );
    // 478.p.3704's 5:00 pm game has `-` stats at capture time: still to come, not "no game".
    expect(gameOn(logs.players[4], "2026-11-10")).toMatchObject({
      state: { kind: "scheduled" },
      minutes: { kind: "notYetPlayed" },
    });
    expect(games.some((game) => game.minutes.kind === "noGame")).toBe(false);
  });

  it("feeds the live signal: on while a shown game is live, off with the next tip-off ahead", async () => {
    const { source } = sourceOver({ [pathFor(RECORDED_KEYS)]: RECORDING });
    const logs = await source.getGameLogs(LEAGUE, RECORDED_KEYS);
    const states = (players: readonly GameLogPlayer[]) =>
      players.flatMap((player) => player.games.map((game) => game.state));
    const capturedAt = Date.parse("2026-11-11T01:02:15Z");

    expect(liveSignal(states(logs.players), capturedAt).gamesLive).toBe(true);

    const notPlayingTonight = logs.players.filter((player) =>
      player.games.every((game) => game.date !== "2026-11-10")
    );
    expect(notPlayingTonight.length).toBeGreaterThan(0);
    expect(liveSignal(states(notPlayingTonight), capturedAt)).toEqual({
      gamesLive: false,
      changesAt: Date.parse("2026-11-12T00:00:00Z"),
    });
  });
});

describe("Yahoo game-log status texts", () => {
  it("reads a later quarter's clock and score, as in the FAN-92 capture (PHI at CHI, Q3)", () => {
    const { body, players } = recordedBody();
    setTonight(players, "Q3 7:48, 77-70", 1);

    const [knicks] = parseGameLogPlayers(body);

    expect(gameOn(knicks, "2026-11-10")?.state).toEqual({
      kind: "live",
      tipOff: "2026-11-11T00:30:00.000Z",
      progress: { kind: "clock", period: 3, clock: "7:48", ownScore: 77, opponentScore: 70 },
    });
  });

  it.each(["Halftime", "OT 2:31, 101-99", "Delayed"])(
    "keeps the live text %s as Yahoo wrote it",
    (status) => {
      const { body, players } = recordedBody();
      setTonight(players, status, 1);

      const [knicks] = parseGameLogPlayers(body);

      expect(gameOn(knicks, "2026-11-10")?.state).toMatchObject({
        kind: "live",
        progress: { kind: "text", text: status },
      });
    }
  );

  it("treats a body that isn't shaped as recorded as YAHOO_UNAVAILABLE", () => {
    const { body, players } = recordedBody();
    const first = entriesOf(players["0"] as RecordedPlayer)[0];
    first.game_log_stats.games = [];

    expect(() => parseGameLogPlayers(body)).toThrow(
      expect.objectContaining({ code: "YAHOO_UNAVAILABLE" })
    );
  });
});

describe("Yahoo game-log calls", () => {
  it("splits both Matchup teams (30 players) into 2 calls of at most 25", async () => {
    const extra = ["478.p.9001", "478.p.9002", "478.p.9003", "478.p.9004", "478.p.9005"];
    const { body: second, players } = recordedBody();
    players.count = extra.length;
    extra.forEach((key, index) => {
      const identity = (players[String(index)] as RecordedPlayer).player[0];
      identity[0] = { player_key: key };
    });
    const { yahoo, source } = sourceOver({
      [pathFor(RECORDED_KEYS)]: RECORDING,
      [pathFor(extra)]: second,
    });

    const logs = await source.getGameLogs(LEAGUE, [...RECORDED_KEYS, ...extra]);

    expect(yahoo.calls).toHaveLength(2);
    expect(logs.players.map((player) => player.playerKey)).toEqual([...RECORDED_KEYS, ...extra]);
  });

  it("answers NOT_FOUND when Yahoo leaves out a player that was asked for", async () => {
    const asked = [...RECORDED_KEYS.slice(0, 24), "478.p.9999"];
    const { source } = sourceOver({ [pathFor(asked)]: RECORDING });

    await expect(source.getGameLogs(LEAGUE, asked)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
