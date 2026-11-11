import { describe, expect, it } from "vitest";
import { missingLine } from "@shared/domain";
import {
  boardRows,
  rankTone,
  recordText,
} from "../../../client/src/features/daily-stats/league-board-model";
import {
  acquisitionText,
  rosterLines,
} from "../../../client/src/features/daily-stats/team-roster-model";
import { buildStatLine, buildTeamTable } from "../../support/builders";

describe("rankTone", () => {
  it("marks the top three and the bottom three whatever the league's size", () => {
    expect([1, 3, 4, 11, 12, 14].map((rank) => rankTone(rank, 14))).toEqual([
      "top",
      "top",
      "none",
      "none",
      "bottom",
      "bottom",
    ]);
    expect(rankTone(7, 10)).toBe("none");
    expect(rankTone(8, 10)).toBe("bottom");
    expect(rankTone(null, 14)).toBe("none");
  });
});

describe("recordText", () => {
  it("shows Yahoo's W–L–T, a dash when it is unknown and nothing while loading", () => {
    const records = new Map([
      ["a", { wins: 36, losses: 27, ties: 2 }],
      ["b", null],
    ]);
    expect(recordText(records, "a")).toBe("36–27–2");
    expect(recordText(records, "b")).toBe("—");
    expect(recordText(null, "a")).toBe("");
  });
});

describe("boardRows", () => {
  it("puts a team with an unknown total last in a category and never ranks it", () => {
    const table = buildTeamTable([{ pts: null }, { pts: 500 }, { pts: 600 }]);

    const rows = boardRows(table, "466.l.1.t.2", "pts", null);

    expect(rows.map((row) => [row.teamName, row.rank, row.value])).toEqual([
      ["Team 3", 1, "600"],
      ["Team 2", 2, "500"],
      ["Team 1", null, "—"],
    ]);
    expect(rows[1]?.isMine).toBe(true);
    expect(rows[0]?.cells).toBeNull();
  });
});

describe("acquisitionText", () => {
  it("words every way a player can arrive", () => {
    expect(acquisitionText({ kind: "drafted", round: 3 })).toBe("Round 3");
    expect(acquisitionText({ kind: "auction", cost: 42 })).toBe("$42");
    expect(acquisitionText({ kind: "waivers", bid: 0 })).toBe("Waivers $0");
    expect(acquisitionText({ kind: "waivers", bid: null })).toBe("Waivers");
    expect(acquisitionText({ kind: "freeAgent" })).toBe("Free agent");
    expect(acquisitionText({ kind: "trade" })).toBe("Trade");
    expect(acquisitionText({ kind: "unknown" })).toBe("Acquired: unknown");
  });
});

describe("rosterLines", () => {
  const player = {
    playerKey: "466.p.1",
    name: "A Player",
    nbaTeam: "BOS",
    positions: ["PG"],
    injuryToday: { designation: "GTD", reason: "Ankle" },
  };
  const roster = {
    fetchedAt: "2026-11-11T20:00:00.000Z",
    teamKey: "466.l.1.t.1",
    date: "2026-11-11",
    players: [{ player, slot: "PG", isStartingSlot: true, line: missingLine("noGame") }],
  };

  it("leaves acquisition and averages out until their datasets load", () => {
    expect(
      rosterLines({ roster, seasonStats: undefined, transactions: undefined, draft: undefined })
    ).toEqual([
      {
        playerKey: "466.p.1",
        name: "A Player",
        nbaTeam: "BOS",
        injury: "GTD",
        acquired: null,
        averages: null,
      },
    ]);
  });

  it("shows season averages per game, and dashes for a player with no games", () => {
    const stats = (gamesPlayed: number) => ({
      fetchedAt: roster.fetchedAt,
      period: "season" as const,
      players: [{ playerKey: "466.p.1", gamesPlayed, line: buildStatLine() }],
    });
    const draft = { fetchedAt: roster.fetchedAt, isAuction: false, picks: [] };
    const transactions = { fetchedAt: roster.fetchedAt, teamKey: roster.teamKey, transactions: [] };

    const [none] = rosterLines({ roster, seasonStats: stats(0), transactions, draft });

    expect(none?.averages).toBe("— PTS · — REB · — AST");
    expect(none?.acquired).toBe("Acquired: unknown");
    const [played] = rosterLines({ roster, seasonStats: stats(2), transactions, draft });
    expect(played?.averages).toMatch(/^\d+\.\d PTS · \d+\.\d REB · \d+\.\d AST$/);
  });
});
