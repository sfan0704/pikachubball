import { describe, expect, it } from "vitest";
import { YahooDailyStatsSource } from "../../../../server/fantasy/yahoo-daily-stats-source";
import { DailyStatsRequests } from "../../../../server/fantasy/yahoo/daily-stats-requests";
import { MAX_SCHEDULE_PAGES } from "../../../../server/fantasy/yahoo/schedule-reader";
import { scheduleByTeam } from "../../../../shared/domain";
import { fixedClock } from "../../../support/clock";
import { silentLogger } from "../../../support/dependencies";
import { replayYahoo, yahooRecording } from "../../../support/yahoo-recordings";

const LEAGUE = "478.l.14822";
/** The FAN-102 game-log body: 25 rostered players on 17 NBA teams, captured on 2026-11-10. */
const RECORDING = "daily-stats/d3-game-logs-by-key";
/** The 13 NBA teams the recording has no player for. */
const OTHER_TEAMS = [
  "CHA", "CHI", "DET", "IND", "LAL", "MEM", "NOP", "OKC", "ORL", "PHX", "SAC", "SAS", "UTA",
]; // prettier-ignore

type RecordedPlayer = { player: [Record<string, unknown>[], unknown] };
type RecordedBody = {
  fantasy_content: { league: [unknown, { players: Record<string, unknown> }] };
};

function pagePath(start: number): string {
  return `/league/${LEAGUE}/players;status=T;start=${start};count=25;out=game_log`;
}

/**
 * A status=T page shaped as Yahoo sends it, built from the recorded game-log
 * body: `teams` relabels players in order and `size` keeps the first players.
 */
function page(options: { teams?: readonly string[]; size?: number } = {}): object {
  const body = JSON.parse(JSON.stringify(yahooRecording(RECORDING))) as RecordedBody;
  const players = body.fantasy_content.league[1].players;
  const size = options.size ?? Number(players.count);
  for (let index = 0; index < Number(players.count); index += 1) {
    const player = players[String(index)] as RecordedPlayer;
    if (index >= size) {
      delete players[String(index)];
      continue;
    }
    const team = options.teams?.[index];
    const identity = player.player[0].find((fragment) => "editorial_team_abbr" in fragment);
    if (team !== undefined && identity !== undefined) {
      identity.editorial_team_abbr = team;
    }
  }
  players.count = size;
  return body;
}

function sourceOver(pages: readonly object[]) {
  const yahoo = replayYahoo(
    Object.fromEntries(pages.map((body, index) => [pagePath(index * 25), body]))
  );
  const source = new YahooDailyStatsSource(
    new DailyStatsRequests(async () => yahoo, silentLogger, fixedClock())
  );
  return { yahoo, source };
}

describe("Yahoo league schedule (D6)", () => {
  it("pages rostered players until all 30 NBA teams are covered", async () => {
    const { yahoo, source } = sourceOver([page(), page({ teams: OTHER_TEAMS })]);
    const schedule = await source.getSchedule(LEAGUE);
    expect(yahoo.calls).toEqual([pagePath(0), pagePath(25)]);
    expect(schedule.teams).toHaveLength(30);
    const names = schedule.teams.map((team) => team.nbaTeam);
    expect(names).toEqual([...names].sort());
  });

  it("keeps each team's games from yesterday on, oldest first, about 8 days ahead", async () => {
    const { source } = sourceOver([page(), page({ teams: OTHER_TEAMS })]);
    const { teams } = await source.getSchedule(LEAGUE);
    const knicks = teams.find((team) => team.nbaTeam === "NYK");
    // The recording's league date is 2026-11-10; Yahoo lists newest first.
    expect(knicks?.games.map((game) => game.date)).toEqual([
      "2026-11-10", "2026-11-11", "2026-11-13", "2026-11-15",
    ]); // prettier-ignore
    const lastDates = teams.map((team) => team.games.at(-1)?.date ?? "");
    expect(lastDates.reduce((a, b) => (a > b ? a : b))).toBe("2026-11-18");
    expect(teams.every((team) => team.games.every((game) => !("minutes" in game)))).toBe(true);
    expect(knicks?.games.find((game) => game.date === "2026-11-10")?.state.kind).toBe("live");
  });

  it("stops at a short page, the end of the league's rostered players", async () => {
    const { yahoo, source } = sourceOver([page({ size: 10 })]);
    const schedule = await source.getSchedule(LEAGUE);
    expect(yahoo.calls).toHaveLength(1);
    expect(schedule.teams.length).toBeLessThan(30);
  });

  it("never makes more than 9 calls, leaving uncovered teams out rather than empty", async () => {
    const { yahoo, source } = sourceOver(Array.from({ length: 12 }, () => page()));
    const schedule = await source.getSchedule(LEAGUE);
    expect(yahoo.calls).toHaveLength(MAX_SCHEDULE_PAGES);
    expect(schedule.teams).toHaveLength(17);
  });

  it("refuses a malformed league key before any call", async () => {
    const { yahoo, source } = sourceOver([page()]);
    await expect(source.getSchedule("not-a-league")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(yahoo.calls).toHaveLength(0);
  });
});

/** The FAN-92 status=T pages: 50 rostered players on 25 NBA teams, league date 2026-11-08, PHI at CHI live. */
const FAN_92_PAGES = ["daily-stats/d6-status-t-start-0", "daily-stats/d6-status-t-start-25"];
/** The five teams the FAN-92 pages have no player for; a short third page supplies them. */
const FAN_92_MISSING = ["CHA", "LAL", "MEM", "OKC", "ORL"];

function fan92Source() {
  const yahoo = replayYahoo({
    [pagePath(0)]: FAN_92_PAGES[0],
    [pagePath(25)]: FAN_92_PAGES[1],
    [pagePath(50)]: page({ teams: FAN_92_MISSING, size: FAN_92_MISSING.length }),
  });
  const source = new YahooDailyStatsSource(
    new DailyStatsRequests(async () => yahoo, silentLogger, fixedClock())
  );
  return { yahoo, source };
}

describe("Yahoo league schedule (D6) on the FAN-92 pages", () => {
  it("covers all 30 teams in 3 calls, from yesterday to about 8 days ahead", async () => {
    const { yahoo, source } = fan92Source();
    const { teams } = await source.getSchedule(LEAGUE);

    expect(yahoo.calls).toEqual([pagePath(0), pagePath(25), pagePath(50)]);
    expect(teams).toHaveLength(30);
    const recorded = teams.filter((team) => !FAN_92_MISSING.includes(team.nbaTeam));
    expect(recorded).toHaveLength(25);
    for (const team of recorded) {
      expect(team.games[0].date >= "2026-11-07").toBe(true);
      // Every team has games still to come after the league date.
      expect((team.games.at(-1)?.date ?? "") > "2026-11-08").toBe(true);
    }
    const lastDates = recorded.map((team) => team.games.at(-1)?.date ?? "");
    expect(lastDates.reduce((a, b) => (a > b ? a : b))).toBe("2026-11-16");
  });

  it("carries the live PHI at CHI game from each team's side", async () => {
    const { teams } = await fan92Source().source.getSchedule(LEAGUE);
    const onDate = (nbaTeam: string) =>
      teams.find((team) => team.nbaTeam === nbaTeam)?.games.find((g) => g.date === "2026-11-08");

    expect(onDate("PHI")).toMatchObject({ opponent: "CHI", isHome: false });
    expect(onDate("PHI")?.state).toMatchObject({
      kind: "live",
      progress: { period: 3, clock: "7:48", ownScore: 77, opponentScore: 70 },
    });
    expect(onDate("CHI")).toMatchObject({ opponent: "PHI", isHome: true });
  });

  it("turns CHI's Friday–Saturday back-to-back over at each viewer's own midnight", async () => {
    const { teams } = await fan92Source().source.getSchedule(LEAGUE);
    const week = { start: "2026-11-10", end: "2026-11-16" };
    const chicago = (iso: string, timeZone: string) =>
      scheduleByTeam(teams, { now: Date.parse(iso), timeZone, week }).get("CHI");

    // CHI tips off at 8 pm Eastern (5 pm Pacific) on 2026-11-13 and 2026-11-14.
    expect(chicago("2026-11-14T04:59:00Z", "America/New_York")?.backToBack).toBe(true);
    expect(chicago("2026-11-14T05:01:00Z", "America/New_York")).toMatchObject({
      tonight: true,
      tomorrow: false,
      backToBack: false,
    });
    expect(chicago("2026-11-14T07:59:00Z", "America/Los_Angeles")?.backToBack).toBe(true);
    expect(chicago("2026-11-14T08:01:00Z", "America/Los_Angeles")?.backToBack).toBe(false);
    expect(chicago("2026-11-10T15:00:00Z", "America/New_York")?.gamesLeftThisWeek).toBe(3);
  });

  it("counts DAL's Sunday–Monday back-to-back across the end of week 3", async () => {
    const { teams } = await fan92Source().source.getSchedule(LEAGUE);
    // Week 3 runs Monday 2026-11-02 to Sunday 2026-11-08, the recording's league date.
    const week = { start: "2026-11-02", end: "2026-11-08" };
    const dallas = (iso: string, timeZone: string) =>
      scheduleByTeam(teams, { now: Date.parse(iso), timeZone, week }).get("DAL");

    // DAL tips off at 7:30 pm Eastern on Sunday 2026-11-08 and 8 pm Eastern on Monday 2026-11-09.
    expect(dallas("2026-11-08T18:00:00Z", "America/New_York")).toMatchObject({
      tonight: true,
      tomorrow: true,
      backToBack: true,
      gamesLeftThisWeek: 1,
    });
    expect(dallas("2026-11-09T07:30:00Z", "America/Los_Angeles")?.backToBack).toBe(true);
  });
});
