import { describe, expect, it } from "vitest";
import {
  draftResponseSchema,
  gameLogsRequestSchema,
  gameLogsResponseSchema,
  leagueParamsSchema,
  playerListQuerySchema,
  playerListResponseSchema,
  playerStatsRequestSchema,
  playerStatsResponseSchema,
  scheduleResponseSchema,
  teamDayParamsSchema,
  teamDayResponseSchema,
  teamParamsSchema,
  transactionsResponseSchema,
  weeksResponseSchema,
} from "../../../shared/api/daily-stats";
import { teamTableSchema } from "../../../shared/api/team-table";
import { measured, missing, missingLine } from "../../../shared/domain";
import { buildStatLine, buildTeamTable } from "../../support/builders";

const FETCHED_AT = "2026-11-08T21:55:00.000Z";
const TIP_OFF = "2026-11-08T23:00:00.000Z";
const LEAGUE = "478.l.14822";
const TEAM = "478.l.14822.t.10";

const player = {
  playerKey: "478.p.6014",
  name: "Player One",
  nbaTeam: "PHI",
  positions: ["PG", "SG"],
  injuryToday: { designation: "GTD", reason: "Ankle" },
};

const game = { gameId: "2026110820", date: "2026-11-08", opponent: "CHI", isHome: false };

describe("daily-stats request schemas", () => {
  it("accepts a team day in the league and rejects a team from another league", () => {
    expect(teamDayParamsSchema.parse({ key: LEAGUE, team: TEAM, date: "2026-11-08" })).toEqual({
      key: LEAGUE,
      team: TEAM,
      date: "2026-11-08",
    });
    expect(
      teamDayParamsSchema.safeParse({ key: LEAGUE, team: "478.l.1.t.10", date: "2026-11-08" })
        .success
    ).toBe(false);
    expect(
      teamDayParamsSchema.safeParse({ key: LEAGUE, team: TEAM, date: "11/08/2026" }).success
    ).toBe(false);
    expect(teamParamsSchema.safeParse({ key: LEAGUE, team: "478.l.2.t.1" }).success).toBe(false);
    expect(leagueParamsSchema.safeParse({ key: "nba" }).success).toBe(false);
  });

  it("splits player keys and rejects keys from another season, repeats and long lists", () => {
    expect(
      gameLogsRequestSchema.parse({ key: LEAGUE, players: "478.p.1,478.p.2" }).players
    ).toEqual(["478.p.1", "478.p.2"]);
    const bad = ["466.p.1", "478.p.1,478.p.1", "", "478.t.1"];
    for (const players of bad) {
      expect(gameLogsRequestSchema.safeParse({ key: LEAGUE, players }).success).toBe(false);
    }
    const fiftyOne = Array.from({ length: 51 }, (_, index) => `478.p.${index}`).join(",");
    expect(gameLogsRequestSchema.safeParse({ key: LEAGUE, players: fiftyOne }).success).toBe(false);
  });

  it("takes only the season, last 7 and last 30 periods", () => {
    const request = { key: LEAGUE, players: "478.p.1" };
    expect(playerStatsRequestSchema.parse({ ...request, period: "last7" }).period).toBe("last7");
    expect(playerStatsRequestSchema.safeParse({ ...request, period: "lastweek" }).success).toBe(
      false
    );
    expect(
      playerStatsRequestSchema.safeParse({ key: LEAGUE, period: "season", players: "466.p.1" })
        .success
    ).toBe(false);
  });

  it("pages the player list by 25", () => {
    const query = { status: "available", sort: "actualRank", start: "25", position: "G" };
    expect(playerListQuerySchema.parse(query).start).toBe(25);
    expect(playerListQuerySchema.safeParse({ ...query, start: "10" }).success).toBe(false);
    expect(playerListQuerySchema.safeParse({ ...query, status: "all" }).success).toBe(false);
    expect(playerListQuerySchema.safeParse({ ...query, search: "  " }).success).toBe(false);
  });
});

describe("daily-stats response schemas", () => {
  it("accepts a team day with every kind of stat value", () => {
    const body = {
      fetchedAt: FETCHED_AT,
      teamKey: TEAM,
      date: "2026-11-08",
      players: [
        { player, slot: "PG", isStartingSlot: true, line: buildStatLine() },
        { player, slot: "SG", isStartingSlot: true, line: missingLine("noGame") },
        { player, slot: "G", isStartingSlot: true, line: missingLine("didNotPlay") },
        { player, slot: "Util", isStartingSlot: true, line: missingLine("notYetPlayed") },
        { player, slot: "BN", isStartingSlot: false, line: missingLine("unavailable") },
      ],
    };
    expect(teamDayResponseSchema.parse(body)).toEqual(body);
  });

  it("rejects a bare zero, more makes than attempts and a response without its fetch time", () => {
    const row = { player, slot: "PG", isStartingSlot: true };
    const body = { fetchedAt: FETCHED_AT, teamKey: TEAM, date: "2026-11-08" };
    const lines = [
      { ...buildStatLine(), pts: 0 },
      buildStatLine({ fg: measured({ makes: 5, attempts: 4 }) }),
      buildStatLine({ reb: measured(-1) }),
      { ...buildStatLine(), ast: { kind: "zero" } },
    ];
    for (const line of lines) {
      const parsed = teamDayResponseSchema.safeParse({ ...body, players: [{ ...row, line }] });
      expect(parsed.success).toBe(false);
    }
    expect(
      teamDayResponseSchema.safeParse({ teamKey: TEAM, date: "2026-11-08", players: [] }).success
    ).toBe(false);
  });

  it("accepts game logs in every game state, with minutes and lines tagged like stats", () => {
    const body = {
      fetchedAt: FETCHED_AT,
      players: [
        {
          playerKey: "478.p.6014",
          nbaTeam: "PHI",
          games: [
            {
              ...game,
              state: { kind: "scheduled", tipOff: TIP_OFF },
              minutes: missing("notYetPlayed"),
              line: missingLine("notYetPlayed"),
            },
            {
              ...game,
              state: {
                kind: "live",
                tipOff: TIP_OFF,
                progress: {
                  kind: "clock",
                  period: 3,
                  clock: "7:48",
                  ownScore: 77,
                  opponentScore: 70,
                },
              },
              minutes: measured(24),
              line: buildStatLine(),
            },
            {
              ...game,
              state: {
                kind: "live",
                tipOff: TIP_OFF,
                progress: { kind: "text", text: "Halftime" },
              },
              minutes: measured(18),
              line: buildStatLine(),
            },
            {
              ...game,
              state: {
                kind: "final",
                tipOff: TIP_OFF,
                result: "W",
                ownScore: 126,
                opponentScore: 107,
              },
              minutes: missing("didNotPlay"),
              line: missingLine("didNotPlay"),
            },
          ],
        },
      ],
    };
    expect(gameLogsResponseSchema.parse(body)).toEqual(body);
  });

  it("rejects a no-game entry in a game log, since no game means no entry", () => {
    const body = {
      fetchedAt: FETCHED_AT,
      players: [
        {
          playerKey: "478.p.1",
          nbaTeam: "PHI",
          games: [
            {
              ...game,
              state: { kind: "noGame" },
              minutes: missing("noGame"),
              line: missingLine("noGame"),
            },
          ],
        },
      ],
    };
    expect(gameLogsResponseSchema.safeParse(body).success).toBe(false);
  });

  it("accepts period totals with games played", () => {
    const body = {
      fetchedAt: FETCHED_AT,
      period: "season",
      players: [{ playerKey: "478.p.1", gamesPlayed: 0, line: missingLine("didNotPlay") }],
    };
    expect(playerStatsResponseSchema.parse(body)).toEqual(body);
  });

  it("accepts a player page whose rostered % is missing for a low-owned player", () => {
    const rostered = { week: 3, percent: null, change: -1 };
    const body = {
      fetchedAt: FETCHED_AT,
      start: 0,
      hasMore: false,
      players: [
        { player, ownership: { kind: "freeAgent" }, rostered },
        { player, ownership: { kind: "waivers", clearsOn: "2026-11-09" }, rostered },
        {
          player: { ...player, injuryToday: null },
          ownership: { kind: "team", teamKey: TEAM, teamName: "Team 10" },
          rostered: { week: 3, percent: 90, change: 0 },
        },
      ],
    };
    expect(playerListResponseSchema.parse(body)).toEqual(body);
    const tooMany = { ...body, players: Array.from({ length: 26 }, () => body.players[0]) };
    expect(playerListResponseSchema.safeParse(tooMany).success).toBe(false);
  });

  it("accepts the schedule, transactions, draft and weeks", () => {
    const schedule = {
      fetchedAt: FETCHED_AT,
      teams: [
        { nbaTeam: "PHI", games: [{ ...game, state: { kind: "scheduled", tipOff: TIP_OFF } }] },
      ],
    };
    const transactions = {
      fetchedAt: FETCHED_AT,
      teamKey: TEAM,
      transactions: [
        {
          transactionKey: "478.l.14822.tr.159",
          kind: "addDrop",
          at: "2026-11-07T09:09:00.000Z",
          waiverBid: 3,
          players: [
            {
              playerKey: "478.p.1",
              move: "add",
              from: { kind: "waivers" },
              to: { kind: "team", teamKey: TEAM },
            },
            {
              playerKey: "478.p.2",
              move: "drop",
              from: { kind: "team", teamKey: TEAM },
              to: { kind: "waivers" },
            },
          ],
        },
      ],
    };
    const draft = {
      fetchedAt: FETCHED_AT,
      isAuction: true,
      picks: [{ pick: 1, round: 1, teamKey: TEAM, playerKey: "478.p.1", cost: 90 }],
    };
    const weeks = {
      fetchedAt: FETCHED_AT,
      weeks: [{ week: 3, start: "2026-11-02", end: "2026-11-08" }],
    };
    expect(scheduleResponseSchema.parse(schedule)).toEqual(schedule);
    expect(transactionsResponseSchema.parse(transactions)).toEqual(transactions);
    expect(draftResponseSchema.parse(draft)).toEqual(draft);
    expect(weeksResponseSchema.parse(weeks)).toEqual(weeks);
    const backwards = { ...weeks, weeks: [{ week: 3, start: "2026-11-08", end: "2026-11-02" }] };
    expect(weeksResponseSchema.safeParse(backwards).success).toBe(false);
  });
});

describe("the week table's games", () => {
  it("carries each team's remaining, live and completed games, or null when unknown", () => {
    const table = buildTeamTable([{}, {}]);
    const withGames = {
      ...table,
      teams: [
        { ...table.teams[0], games: { remaining: 7, live: 1, completed: 31 } },
        table.teams[1],
      ],
    };
    expect(teamTableSchema.parse(withGames)).toEqual(withGames);
    const negative = {
      ...table,
      teams: [{ ...table.teams[0], games: { remaining: -1, live: 0, completed: 0 } }],
    };
    expect(teamTableSchema.safeParse(negative).success).toBe(false);
  });
});
