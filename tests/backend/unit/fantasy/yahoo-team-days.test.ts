import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  countedGames,
  countedTotals,
  type PlayerDay,
  type TeamTotals,
} from "../../../../shared/domain";
import type { TeamDay } from "../../../../server/fantasy/daily-stats-source";
import { YahooDailyStatsSource } from "../../../../server/fantasy/yahoo-daily-stats-source";
import { DailyStatsRequests } from "../../../../server/fantasy/yahoo/daily-stats-requests";
import { fixedClock } from "../../../support/clock";
import { silentLogger } from "../../../support/dependencies";
import { replayYahoo, yahooRecording } from "../../../support/yahoo-recordings";

/*
 * FAN-91's week-2 capture (league renumbered): both matchup teams, each date of
 * the week, with Yahoo's own daily and weekly team totals to reconcile with.
 */
const LEAGUE = "478.l.100000";
const TEAMS = { mine: `${LEAGUE}.t.10`, opponent: `${LEAGUE}.t.9` } as const;
type Side = keyof typeof TEAMS;
const WEEK_2 = [
  "2026-10-26",
  "2026-10-27",
  "2026-10-28",
  "2026-10-29",
  "2026-10-30",
  "2026-10-31",
  "2026-11-01",
];
const RECORDINGS = "daily-stats/fan-91-week-2";

const teamDayPath = (side: Side, date: string) =>
  `/team/${TEAMS[side]}/roster;date=${date}/players/stats;type=date;date=${date}`;

function week2Recordings(): Record<string, string> {
  const recordings: Record<string, string> = {
    "/game/478/game_weeks": `${RECORDINGS}/game-weeks`,
  };
  for (const side of ["mine", "opponent"] as const) {
    for (const date of WEEK_2) {
      recordings[teamDayPath(side, date)] = `${RECORDINGS}/${side}-${date}-roster-stats`;
    }
  }
  return recordings;
}

function sourceOver(recordings: Readonly<Record<string, string | object>> = week2Recordings()) {
  const yahoo = replayYahoo(recordings);
  const requests = () =>
    new DailyStatsRequests(async () => yahoo, silentLogger, fixedClock("2026-11-02T12:00:00Z"));
  // One source per API request, as the composition root builds it.
  const source = () => new YahooDailyStatsSource(requests());
  return { yahoo, source };
}

/** Yahoo's team totals (`team_stats`) from a recorded team stats body. */
const teamTotalsSchema = z
  .object({
    fantasy_content: z.object({
      team: z.tuple([
        z.unknown(),
        z.object({
          team_stats: z.object({
            stats: z.array(
              z.object({ stat: z.object({ stat_id: z.coerce.string(), value: z.string() }) })
            ),
          }),
          team_remaining_games: z
            .object({ total: z.object({ completed_games: z.number() }) })
            .optional(),
        }),
      ]),
    }),
  })
  .transform(({ fantasy_content }) => {
    const { team_stats, team_remaining_games } = fantasy_content.team[1];
    const value = (id: string) =>
      team_stats.stats.find(({ stat }) => stat.stat_id === id)?.stat.value ?? "";
    const pair = (id: string) => value(id).split("/").map(Number);
    const [fgMakes, fgAttempts] = pair("9004003");
    const [ftMakes, ftAttempts] = pair("9007006");
    const count = (id: string) => Number(value(id));
    const totals: TeamTotals = {
      fgMakes,
      fgAttempts,
      ftMakes,
      ftAttempts,
      tpm: count("10"),
      pts: count("12"),
      reb: count("15"),
      ast: count("16"),
      stl: count("17"),
      blk: count("18"),
      to: count("19"),
    };
    return { totals, completedGames: team_remaining_games?.total.completed_games };
  });

const yahooTeamStats = (name: string) =>
  teamTotalsSchema.parse(yahooRecording(`${RECORDINGS}/${name}`));

function playerDays(day: TeamDay): PlayerDay[] {
  return day.players.map(({ player, slot, isStartingSlot, line }) => ({
    playerKey: player.playerKey,
    date: day.date,
    slot,
    isStartingSlot,
    line,
  }));
}

describe("YahooDailyStatsSource team days (D2) against FAN-91 week 2", () => {
  it.each(
    (["mine", "opponent"] as const).flatMap((side) => WEEK_2.map((date) => [side, date] as const))
  )("sums %s's starting slots on %s to Yahoo's daily team totals", async (side, date) => {
    const { source } = sourceOver();

    const day = await source().getTeamDay(LEAGUE, TEAMS[side], date);

    expect(day).toMatchObject({ teamKey: TEAMS[side], date });
    expect(countedTotals(playerDays(day))).toEqual(yahooTeamStats(`${side}-${date}-stats`).totals);
  });

  it.each(["mine", "opponent"] as const)(
    "sums %s's week of starting slots to Yahoo's week totals and completed games",
    async (side) => {
      const { source } = sourceOver();
      const reader = source();

      const days = await Promise.all(
        WEEK_2.map((date) => reader.getTeamDay(LEAGUE, TEAMS[side], date))
      );
      const week = days.flatMap(playerDays);

      const yahoo = yahooTeamStats(`${side}-stats-week`);
      expect(countedTotals(week)).toEqual(yahoo.totals);
      expect(countedGames(week)).toBe(yahoo.completedGames);
    }
  );

  it("reads slots, the starting flag, injuries and tagged values", async () => {
    const { source } = sourceOver();

    const day = await source().getTeamDay(LEAGUE, TEAMS.mine, "2026-10-27");

    const slots = new Map(day.players.map(({ slot, isStartingSlot }) => [slot, isStartingSlot]));
    expect(slots.get("BN")).toBe(false);
    expect(slots.get("IL")).toBe(false);
    expect(slots.get("Util")).toBe(true);
    expect(slots.get("PG")).toBe(true);
    const injured = day.players.find(({ player }) => player.playerKey === "478.p.5187");
    expect(injured).toMatchObject({
      slot: "PG",
      isStartingSlot: true,
      player: {
        nbaTeam: "CHA",
        positions: ["PG", "SG"],
        injuryToday: { designation: "O", reason: "Thigh" },
      },
      line: { fg: { kind: "noGame" }, pts: { kind: "noGame" } },
    });
  });

  it("leaves bench and IL days out of counted totals", async () => {
    const { source } = sourceOver();
    const day = await source().getTeamDay(LEAGUE, TEAMS.mine, "2026-10-27");
    const benched = day.players.filter(({ isStartingSlot }) => !isStartingSlot);
    const played = { kind: "value", value: 10 } as const;

    const withBenchGame = playerDays({
      ...day,
      players: benched.map((entry) => ({ ...entry, line: { ...entry.line, pts: played } })),
    });

    expect(benched.length).toBeGreaterThan(0);
    expect(countedTotals(withBenchGame).pts).toBe(0);
  });
});

describe("YahooDailyStatsSource team day calls", () => {
  it("spends 2 calls on Today, 2 more on Yesterday and 14 on a full Week", async () => {
    const { yahoo, source } = sourceOver();
    const lastDay = WEEK_2[WEEK_2.length - 1];
    const bothTeams = (date: string) =>
      Promise.all([
        source().getTeamDay(LEAGUE, TEAMS.mine, date),
        source().getTeamDay(LEAGUE, TEAMS.opponent, date),
      ]);

    await bothTeams(lastDay);
    expect(yahoo.calls).toHaveLength(2);
    await bothTeams(WEEK_2[WEEK_2.length - 2]);
    expect(yahoo.calls).toHaveLength(4);

    yahoo.calls.length = 0;
    await Promise.all(WEEK_2.map(bothTeams));
    expect(yahoo.calls).toHaveLength(14);
  });

  it("fetches a repeated team day once within one request", async () => {
    const { yahoo, source } = sourceOver();
    const reader = source();

    await reader.getTeamDay(LEAGUE, TEAMS.mine, WEEK_2[0]);
    await reader.getTeamDay(LEAGUE, TEAMS.mine, WEEK_2[0]);

    expect(yahoo.calls).toEqual([teamDayPath("mine", WEEK_2[0])]);
  });

  it("fails only the date Yahoo couldn't answer", async () => {
    const recordings = week2Recordings();
    delete recordings[teamDayPath("mine", WEEK_2[3])];
    const { source } = sourceOver(recordings);

    const results = await Promise.allSettled(
      WEEK_2.map((date) => source().getTeamDay(LEAGUE, TEAMS.mine, date))
    );

    expect(results.map(({ status }) => status)).toEqual([
      "fulfilled",
      "fulfilled",
      "fulfilled",
      "rejected",
      "fulfilled",
      "fulfilled",
      "fulfilled",
    ]);
    expect(results[3]).toMatchObject({ reason: { code: "YAHOO_UNAVAILABLE" } });
  });

  it("rejects a roster for another date as YAHOO_UNAVAILABLE", async () => {
    const { source } = sourceOver({
      [teamDayPath("mine", WEEK_2[1])]: `${RECORDINGS}/mine-${WEEK_2[0]}-roster-stats`,
    });

    await expect(source().getTeamDay(LEAGUE, TEAMS.mine, WEEK_2[1])).rejects.toMatchObject({
      code: "YAHOO_UNAVAILABLE",
    });
  });

  it("rejects a roster for another team as YAHOO_UNAVAILABLE", async () => {
    const { source } = sourceOver({
      [teamDayPath("opponent", WEEK_2[0])]: `${RECORDINGS}/mine-${WEEK_2[0]}-roster-stats`,
    });

    await expect(source().getTeamDay(LEAGUE, TEAMS.opponent, WEEK_2[0])).rejects.toMatchObject({
      code: "YAHOO_UNAVAILABLE",
    });
  });
});

describe("YahooDailyStatsSource scoring weeks (D10)", () => {
  it("reads every week's dates in one call", async () => {
    const { yahoo, source } = sourceOver();

    const { weeks } = await source().getWeeks(LEAGUE);

    expect(yahoo.calls).toEqual(["/game/478/game_weeks"]);
    expect(weeks).toHaveLength(23);
    expect(weeks[0]).toEqual({ week: 1, start: "2026-10-20", end: "2026-10-25" });
    expect(weeks[1]).toEqual({ week: 2, start: WEEK_2[0], end: WEEK_2[6] });
    expect(weeks.map(({ week }) => week)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
  });

  it("rejects another season's weeks as YAHOO_UNAVAILABLE", async () => {
    const { source } = sourceOver({ "/game/466/game_weeks": `${RECORDINGS}/game-weeks` });

    await expect(source().getWeeks("466.l.100000")).rejects.toMatchObject({
      code: "YAHOO_UNAVAILABLE",
    });
  });
});
