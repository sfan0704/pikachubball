import { describe, expect, it } from "vitest";
import { YahooScrubber } from "../../../../server/dev/scrub-yahoo";
import { checkLeaks } from "../../../../scripts/yahoo-research/leaks";
import { browserSteps } from "../../../../scripts/yahoo-research/browser";
import { gameLogCalls, gameLogReadme } from "../../../../scripts/yahoo-research/game-log";
import {
  currentWeek,
  datesBetween,
  fantasyDates,
  ownTeam,
  samplePlayers,
} from "../../../../scripts/yahoo-research/discover";
import {
  pagedCalls,
  plannedCalls,
  type ResearchContext,
} from "../../../../scripts/yahoo-research/plan";

const context: ResearchContext = {
  leagueKey: "466.l.123",
  teamKey: "466.l.123.t.4",
  currentWeek: 3,
  today: "2026-11-07",
  yesterday: "2026-11-06",
  tomorrow: "2026-11-08",
  players: ["466.p.1", "466.p.2", "466.p.3"],
};

describe("plannedCalls", () => {
  it("covers every research ticket, with distinct files within each ticket", () => {
    const calls = plannedCalls(context);
    const tickets = new Set(calls.map((call) => call.ticket));

    expect([...tickets]).toEqual(["FAN-92", "FAN-93", "FAN-94", "FAN-95", "FAN-96"]);
    for (const ticket of tickets) {
      const files = calls.filter((call) => call.ticket === ticket).map((call) => call.file);
      expect(new Set(files).size).toBe(files.length);
    }
  });

  it("only reads, and puts the period on the stats sub-resource", () => {
    const paths = plannedCalls(context).map((call) => call.path);

    expect(paths.every((path) => path.startsWith("/"))).toBe(true);
    expect(paths).toContain(
      "/players;player_keys=466.p.1,466.p.2,466.p.3/stats;type=date;date=2026-11-06"
    );
    expect(paths).toContain(
      "/league/466.l.123/players;player_keys=466.p.1/stats;type=projected_week;week=3"
    );
  });
});

describe("pagedCalls", () => {
  it("pages taken players, the pool and transactions by 25", () => {
    const paths = pagedCalls(context).map((call) => call.pathAt(50));

    expect(paths).toEqual([
      "/league/466.l.123/players;status=T;start=50;count=25/ownership",
      "/league/466.l.123/players;start=50;count=25",
      "/league/466.l.123/transactions;start=50;count=25",
    ]);
  });
});

describe("browserSteps", () => {
  it("fills in this league's website URLs for the tickets that asked for pages", () => {
    const steps = browserSteps(context);

    expect([...steps.keys()]).toEqual(["FAN-92", "FAN-93", "FAN-94", "FAN-95"]);
    expect(steps.get("FAN-92")?.[0]?.url).toBe(
      "https://basketball.fantasysports.yahoo.com/nba/123/4"
    );
    expect(steps.get("FAN-94")?.[1]?.url).toContain("/nba/123/players?status=ALL");
  });
});

describe("discovery", () => {
  const userTeams = {
    teams: [
      { team_key: "428.l.9.t.1" },
      { team_key: "466.l.123.t.4" },
      { team_key: "466.l.777.t.2" },
    ],
  };

  it("picks the team in the newest league, or in the chosen one", () => {
    expect(ownTeam(userTeams)).toEqual({ leagueKey: "466.l.123", teamKey: "466.l.123.t.4" });
    expect(ownTeam(userTeams, "466.l.777").teamKey).toBe("466.l.777.t.2");
    expect(() => ownTeam(userTeams, "466.l.5")).toThrow("no team");
  });

  it("reads the current week and refuses a league without one", () => {
    expect(currentWeek({ league: [{ current_week: 3 }] })).toBe(3);
    expect(() => currentWeek({ league: [] })).toThrow("current_week");
  });

  it("lists every date of a week, across a month end", () => {
    expect(datesBetween("2026-10-31", "2026-11-01")).toEqual(["2026-10-31", "2026-11-01"]);
    expect(datesBetween("2026-10-27", "2026-11-02")).toHaveLength(7);
  });

  it("uses US Eastern dates", () => {
    // 03:00 UTC on 8 Nov is still 7 Nov in New York.
    expect(fantasyDates(new Date("2026-11-08T03:00:00Z"))).toEqual({
      today: "2026-11-07",
      yesterday: "2026-11-06",
      tomorrow: "2026-11-08",
    });
  });

  it("samples a healthy player, then an injured one, then another", () => {
    const player = (key: string, status?: string): unknown => ({
      player: [
        [{ player_key: key }, { name: { full: key } }, ...(status ? [{ status }] : [])],
        { selected_position: [] },
      ],
    });
    const roster = {
      players: {
        0: player("466.p.1", "INJ"),
        1: player("466.p.2"),
        2: player("466.p.3"),
        3: player("466.p.4", "O"),
      },
    };

    expect(samplePlayers(roster)).toEqual(["466.p.2", "466.p.1", "466.p.3"]);
    expect(() => samplePlayers({ players: { 0: player("466.p.1") } })).toThrow("--players");
  });
});

describe("checkLeaks", () => {
  const scrubbed = (): YahooScrubber => {
    const scrubber = new YahooScrubber();
    scrubber.scrub({ team: [[{ team_key: "466.l.1.t.2" }, { name: "Jalen" }]] });
    return scrubber;
  };
  const file = (body: unknown): Map<string, string> =>
    new Map([["FAN-95/01-pool.json", JSON.stringify(body)]]);

  it("lets a removed name through when it is only a public player or NBA team name", () => {
    const pool = { player: [{ name: { full: "Jalen Brunson", first: "Jalen" } }] };

    expect(() => checkLeaks(scrubbed(), file(pool))).not.toThrow();
  });

  it("fails on a removed name left in any other field, naming the file and key", () => {
    expect(() => checkLeaks(scrubbed(), file({ team_name: "Jalen" }))).toThrow(
      "FAN-95/01-pool.json: team_name"
    );
  });
});

describe("gameLogCalls", () => {
  it("reads two pages of rostered players' game logs, one file per page and round", () => {
    const calls = gameLogCalls("466.l.123", 2);
    expect(calls).toEqual([
      {
        file: "round-2-rostered-start-0.json",
        path: "/league/466.l.123/players;status=T;start=0;count=25;out=game_log",
      },
      {
        file: "round-2-rostered-start-25.json",
        path: "/league/466.l.123/players;status=T;start=25;count=25;out=game_log",
      },
    ]);
  });

  it("lists each call's time and status in the README", () => {
    const readme = gameLogReadme("466.l.123", [
      { file: "a.json", path: "/x", status: 200, at: "2026-11-09T01:00:00.000Z" },
    ]);
    expect(readme).toContain("| 2026-11-09T01:00:00.000Z | 200 | `a.json` | `/x` |");
  });
});
