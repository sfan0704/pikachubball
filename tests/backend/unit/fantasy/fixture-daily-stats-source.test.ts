import { describe, expect, it } from "vitest";
import { appearance } from "../../../../shared/domain";
import type { DailyStatsSource } from "../../../../server/fantasy/daily-stats-source";
import { FixtureDailyStatsSource } from "../../../../server/fantasy/fixture/fixture-daily-stats-source";
import { fixedClock } from "../../../support/clock";

const LEAGUE = "466.l.100000";
const TEAM = `${LEAGUE}.t.11`;
const TODAY = "2026-11-11";
// 8 pm Eastern on a Wednesday.
const source: DailyStatsSource = new FixtureDailyStatsSource(
  fixedClock("2026-11-12T01:00:00.000Z")
);

describe("the fixture daily-stats source", () => {
  it("dates today in US Eastern time", async () => {
    const day = await source.getTeamDay(LEAGUE, TEAM, TODAY);

    expect(day).toMatchObject({ teamKey: TEAM, date: TODAY });
  });

  it("shows every kind of player day today, plus bench and IL", async () => {
    const { players } = await source.getTeamDay(LEAGUE, TEAM, TODAY);

    expect(new Set(players.map((entry) => appearance(entry.line)))).toEqual(
      new Set(["played", "noGame", "didNotPlay", "notYetPlayed", "unavailable"])
    );
    expect(players.filter((entry) => !entry.isStartingSlot).map((entry) => entry.slot)).toEqual([
      "BN",
      "BN",
      "IL",
    ]);
  });

  it("has a live, a final and a not-started game today in the game logs", async () => {
    const { players } = await source.getGameLogs(LEAGUE, [
      "466.p.11101",
      "466.p.11102",
      "466.p.11103",
    ]);

    const today = players.map((player) => player.games.find((game) => game.date === TODAY));
    expect(today.map((game) => game?.state.kind)).toEqual(["live", "final", "scheduled"]);
  });

  it("gives each game-log game the same line as the player's team day", async () => {
    const day = await source.getTeamDay(LEAGUE, TEAM, TODAY);
    const keys = day.players.map((entry) => entry.player.playerKey);
    const { players } = await source.getGameLogs(LEAGUE, keys);

    for (const entry of day.players) {
      const log = players.find((player) => player.playerKey === entry.player.playerKey);
      const game = log?.games.find((candidate) => candidate.date === TODAY);
      if (game) {
        expect(game.line).toEqual(entry.line);
      } else {
        expect(appearance(entry.line)).toBe("noGame");
      }
    }
  });

  it("has an injured player today and one out on IL", async () => {
    const { players } = await source.getTeamDay(LEAGUE, TEAM, TODAY);

    expect(players.map((entry) => entry.player.injuryToday?.designation).filter(Boolean)).toEqual([
      "GTD",
      "O",
    ]);
  });

  it("swaps the dropped player for the added one two days ago", async () => {
    const before = await source.getTeamDay(LEAGUE, TEAM, "2026-11-08");
    const after = await source.getTeamDay(LEAGUE, TEAM, "2026-11-09");
    const { transactions } = await source.getTransactions(LEAGUE, TEAM);

    const [addDrop] = transactions;
    const added = addDrop.players.find((move) => move.move === "add")?.playerKey;
    const dropped = addDrop.players.find((move) => move.move === "drop")?.playerKey;
    expect(before.players.map((entry) => entry.player.playerKey)).toContain(dropped);
    expect(after.players.map((entry) => entry.player.playerKey)).toContain(added);
    expect(after.players.map((entry) => entry.player.playerKey)).not.toContain(dropped);
  });

  it("lists dropped players on waivers until tomorrow", async () => {
    const page = await source.listPlayers(LEAGUE, {
      status: "waivers",
      sort: "actualRank",
      start: 0,
    });

    expect(page.players).toHaveLength(14);
    expect(page.players[0].ownership).toEqual({ kind: "waivers", clearsOn: "2026-11-12" });
    expect(page.hasMore).toBe(false);
  });

  it("pages owned players by 25, filtered by position and search", async () => {
    const first = await source.listPlayers(LEAGUE, {
      status: "owned",
      sort: "overallRank",
      start: 0,
    });
    const centers = await source.listPlayers(LEAGUE, {
      status: "owned",
      sort: "actualRank",
      start: 0,
      position: "C",
    });
    const search = await source.listPlayers(LEAGUE, {
      status: "available",
      sort: "actualRank",
      start: 0,
      search: "rivers 30",
    });
    const guards = await source.listPlayers(LEAGUE, {
      status: "available",
      sort: "actualRank",
      start: 0,
      position: "G",
    });

    expect(first).toMatchObject({ start: 0, hasMore: true });
    expect(first.players).toHaveLength(25);
    expect(centers.players.every((row) => row.player.positions.includes("C"))).toBe(true);
    expect(search.players.map((row) => row.player.name)).toEqual(["Devon Rivers 30"]);
    expect(
      guards.players.every((row) => row.player.positions.some((p) => ["PG", "SG"].includes(p)))
    ).toBe(true);
  });

  it("reports no games played for a player who is out", async () => {
    const { players } = await source.getPlayerStats(LEAGUE, "season", [
      "466.p.11113",
      "466.p.11101",
    ]);

    expect(players.map((player) => player.gamesPlayed)).toEqual([0, 12]);
    expect(appearance(players[0].line)).toBe("didNotPlay");
  });

  it("drafts eleven snake rounds and puts today in week 5", async () => {
    const draft = await source.getDraft(LEAGUE);
    const { weeks } = await source.getWeeks(LEAGUE);
    const schedule = await source.getSchedule(LEAGUE);

    expect(draft.picks).toHaveLength(154);
    expect(draft.picks[14]).toMatchObject({ pick: 15, round: 2, teamKey: `${LEAGUE}.t.14` });
    expect(weeks[4]).toEqual({ week: 5, start: "2026-11-09", end: "2026-11-15" });
    expect(schedule.teams).toHaveLength(8);
    expect(schedule.teams.every((team) => team.games.every((game) => game.date >= TODAY))).toBe(
      true
    );
  });
});
