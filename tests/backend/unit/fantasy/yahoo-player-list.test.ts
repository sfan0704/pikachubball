import { describe, expect, it } from "vitest";
import type { PlayerListQuery } from "../../../../shared/api/daily-stats";
import { YahooDailyStatsSource } from "../../../../server/fantasy/yahoo-daily-stats-source";
import { DailyStatsRequests } from "../../../../server/fantasy/yahoo/daily-stats-requests";
import { fixedClock } from "../../../support/clock";
import { silentLogger } from "../../../support/dependencies";
import { replayYahoo, yahooRecording } from "../../../support/yahoo-recordings";

const LEAGUE = "478.l.14822";
const OUT = "out=ownership,percent_owned";
const FIRST_AVAILABLE = `/league/${LEAGUE}/players;status=A;sort=AR;start=0;count=25;${OUT}`;

type Fragment = Record<string, unknown>;
type RecordedPlayer = { player: unknown[] };

/**
 * FAN-95 recorded the waiver, owned and position lists with `/ownership` or
 * with no `out`, so their bodies lack the blocks D5's `out=ownership,percent_owned`
 * adds. This appends the missing ones in the shape the full recording
 * (`d5-available`) shows: a free agent, and a week-3 rostered % Yahoo left out.
 */
function withListBlocks(name: string): object {
  const body = yahooRecording(name) as {
    fantasy_content: { league: [unknown, { players: Record<string, RecordedPlayer | number> }] };
  };
  for (const entry of Object.values(body.fantasy_content.league[1].players)) {
    if (typeof entry === "number") {
      continue;
    }
    const blocks = entry.player.slice(1) as Fragment[];
    if (!blocks.some((block) => "ownership" in block)) {
      entry.player.push({ ownership: { ownership_type: "freeagents" } });
    }
    if (!blocks.some((block) => "percent_owned" in block)) {
      entry.player.push({
        percent_owned: [{ coverage_type: "week", week: 3 }, { delta: "0" }],
      });
    }
  }
  return body;
}

function sourceOver(recordings: Record<string, string | object>) {
  const yahoo = replayYahoo(recordings);
  const source = new YahooDailyStatsSource(
    new DailyStatsRequests(async () => yahoo, silentLogger, fixedClock())
  );
  return { yahoo, source };
}

const firstAvailable: PlayerListQuery = { status: "available", sort: "actualRank", start: 0 };

describe("YahooDailyStatsSource player list (D5)", () => {
  it("reads a full available page in one call, so another page may follow", async () => {
    const { yahoo, source } = sourceOver({ [FIRST_AVAILABLE]: "daily-stats/d5-available" });

    const page = await source.listPlayers(LEAGUE, firstAvailable);

    expect(yahoo.calls).toEqual([FIRST_AVAILABLE]);
    expect(page.start).toBe(0);
    expect(page.players).toHaveLength(25);
    expect(page.hasMore).toBe(true);
    expect(page.players[0]).toEqual({
      player: {
        playerKey: "478.p.4245",
        name: "Al Horford",
        nbaTeam: "GSW",
        positions: ["PF", "C"],
        injuryToday: null,
      },
      ownership: { kind: "freeAgent" },
      rostered: { week: 3, percent: 3, change: 0 },
    });
  });

  it("keeps a missing rostered % as null (<1%), never 0", async () => {
    const { source } = sourceOver({ [FIRST_AVAILABLE]: "daily-stats/d5-available" });

    const { players } = await source.listPlayers(LEAGUE, firstAvailable);

    const conley = players.find(({ player }) => player.playerKey === "478.p.4246");
    expect(conley?.rostered).toEqual({ week: 3, percent: null, change: 0 });
    expect(players.filter(({ rostered }) => rostered.percent === null)).toHaveLength(14);
    expect(players.some(({ rostered }) => rostered.percent === 0)).toBe(false);
  });

  it("labels NA and injured players with Yahoo's designation and reason", async () => {
    const { source } = sourceOver({ [FIRST_AVAILABLE]: "daily-stats/d5-available" });

    const { players } = await source.listPlayers(LEAGUE, firstAvailable);
    const byKey = new Map(players.map((row) => [row.player.playerKey, row]));

    expect(byKey.get("478.p.4247")?.player.injuryToday).toEqual({
      designation: "NA",
      reason: null,
    });
    expect(byKey.get("478.p.4901")?.player.injuryToday).toEqual({
      designation: "O",
      reason: "Calf",
    });
    expect(byKey.get("478.p.4886")?.player.name).toBe("Jonas Valančiūnas");
  });

  it("reads a waiver row with Yahoo's clear day and weekly delta", async () => {
    const { source } = sourceOver({ [FIRST_AVAILABLE]: "daily-stats/d5-available" });

    const { players } = await source.listPlayers(LEAGUE, firstAvailable);

    expect(players.find(({ player }) => player.playerKey === "478.p.5187")).toMatchObject({
      player: { name: "Dennis Schröder", positions: ["PG", "SG"] },
      ownership: { kind: "waivers", clearsOn: "2026-11-08" },
      rostered: { week: 3, percent: 10, change: -15 },
    });
  });

  it("lists waivers with status W, each with its clear day", async () => {
    const path = `/league/${LEAGUE}/players;status=W;sort=OR;start=0;count=25;${OUT}`;
    const { yahoo, source } = sourceOver({
      [path]: withListBlocks("daily-stats/d5-waivers-ownership-only"),
    });

    const page = await source.listPlayers(LEAGUE, {
      status: "waivers",
      sort: "overallRank",
      start: 0,
    });

    expect(yahoo.calls).toEqual([path]);
    expect(page.hasMore).toBe(false);
    expect(page.players).toHaveLength(5);
    expect(page.players.map(({ ownership }) => ownership)).toEqual([
      { kind: "waivers", clearsOn: "2026-11-08" },
      { kind: "waivers", clearsOn: "2026-11-08" },
      { kind: "waivers", clearsOn: "2026-11-08" },
      { kind: "waivers", clearsOn: "2026-11-08" },
      { kind: "waivers", clearsOn: "2026-11-09" },
    ]);
  });

  it("lists owned players with status T and their team, stopping at a short page", async () => {
    const path = `/league/${LEAGUE}/players;status=T;sort=AR;start=200;count=25;${OUT}`;
    const { source } = sourceOver({
      [path]: withListBlocks("daily-stats/d5-owned-last-page-ownership-only"),
    });

    const page = await source.listPlayers(LEAGUE, {
      status: "owned",
      sort: "actualRank",
      start: 200,
    });

    expect(page).toMatchObject({ start: 200, hasMore: false });
    expect(page.players).toEqual([
      expect.objectContaining({
        player: expect.objectContaining({ playerKey: "478.p.10607", nbaTeam: "DEN" }),
        ownership: { kind: "team", teamKey: `${LEAGUE}.t.7`, teamName: "Team-24" },
      }),
    ]);
  });

  it("filters by position in the same single call", async () => {
    const path = `/league/${LEAGUE}/players;status=A;position=C;sort=AR;start=25;count=25;${OUT}`;
    const { yahoo, source } = sourceOver({
      [path]: withListBlocks("daily-stats/d5-position-c-no-out"),
    });

    const page = await source.listPlayers(LEAGUE, { ...firstAvailable, position: "C", start: 25 });

    expect(yahoo.calls).toEqual([path]);
    expect(page.players).toHaveLength(25);
    expect(page.players.every(({ player }) => player.positions.includes("C"))).toBe(true);
  });

  it("sends an accented search as plain letters and reads an empty answer", async () => {
    const path = `/league/${LEAGUE}/players;status=A;search=Doncic;sort=AR;start=0;count=25;${OUT}`;
    const { yahoo, source } = sourceOver({ [path]: "daily-stats/d5-search-doncic" });

    const page = await source.listPlayers(LEAGUE, { ...firstAvailable, search: "Dončić" });

    expect(yahoo.calls).toEqual([path]);
    expect(page).toEqual({ start: 0, hasMore: false, players: [] });
  });

  it("encodes search text so it can't add Yahoo filters", async () => {
    const path = `/league/${LEAGUE}/players;status=A;search=De'Aaron%3Bstatus%3DT;sort=AR;start=0;count=25;${OUT}`;
    const { yahoo, source } = sourceOver({ [path]: "daily-stats/d5-search-doncic" });

    await source.listPlayers(LEAGUE, { ...firstAvailable, search: "De'Aaron;status=T" });

    expect(yahoo.calls).toEqual([path]);
  });

  it("fails as YAHOO_UNAVAILABLE when a row lacks its ownership", async () => {
    const { source } = sourceOver({
      [FIRST_AVAILABLE]: yahooRecording("daily-stats/d5-position-c-no-out") as object,
    });

    await expect(source.listPlayers(LEAGUE, firstAvailable)).rejects.toMatchObject({
      code: "YAHOO_UNAVAILABLE",
    });
  });

  it("fetches each further page, search or position change with one call of its own", async () => {
    const pages = [0, 25, 50].map(
      (start) => `/league/${LEAGUE}/players;status=A;sort=AR;start=${start};count=25;${OUT}`
    );
    const { yahoo, source } = sourceOver(
      Object.fromEntries(pages.map((path) => [path, "daily-stats/d5-available"]))
    );

    for (const start of [0, 25, 50]) {
      await source.listPlayers(LEAGUE, { ...firstAvailable, start });
    }

    expect(yahoo.calls).toEqual(pages);
  });
});
