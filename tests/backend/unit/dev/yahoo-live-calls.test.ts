import { describe, expect, it } from "vitest";
import {
  gameLogPlayers,
  gameLogsPath,
  gameLogsSummary,
  liveCallsReadme,
  multiKeyPlayers,
  teamTransactionsPath,
  tradingTeam,
  transactionsSummary,
} from "../../../../scripts/yahoo-research/live-calls";

// Yahoo's nesting: a player's properties are sibling objects, the game log beside them.
function player(key: string, live: 0 | 1): unknown {
  return {
    player: [
      [{ player_key: key }, { name: { full: "A Player" } }],
      { game_log: [{ game: { is_game_live: live } }] },
    ],
  };
}

function page(...players: unknown[]): unknown {
  return { fantasy_content: { league: [{}, { players: { ...players, count: players.length } }] } };
}

function transaction(type: string, teamKey: string): unknown {
  return {
    transaction: [
      { transaction_key: "466.l.123.tr.1", type },
      {
        players: {
          0: {
            player: [
              [{ player_key: "466.p.1" }],
              { transaction_data: { type, destination_team_key: teamKey } },
            ],
          },
        },
      },
    ],
  };
}

describe("gameLogPlayers", () => {
  it("lists each player once with whether a game is live", () => {
    expect(gameLogPlayers(page(player("466.p.1", 0), player("466.p.2", 1)))).toEqual([
      { key: "466.p.1", live: false },
      { key: "466.p.2", live: true },
    ]);
  });
});

describe("multiKeyPlayers", () => {
  it("puts live players first and stops at 25 distinct keys", () => {
    const first = Array.from({ length: 20 }, (_, i) => player(`466.p.${i}`, 0));
    const second = [
      player("466.p.0", 0),
      ...Array.from({ length: 10 }, (_, i) => player(`466.p.${100 + i}`, i === 9 ? 1 : 0)),
    ];

    const keys = multiKeyPlayers([page(...first), page(...second)]);

    expect(keys).toHaveLength(25);
    expect(keys[0]).toBe("466.p.109");
    expect(new Set(keys).size).toBe(25);
  });
});

describe("tradingTeam", () => {
  it("finds the first team that traded, or none", () => {
    const feed = {
      transactions: [{ trader_team_key: "466.l.123.t.7" }, { trader_team_key: "466.l.123.t.3" }],
    };

    expect(tradingTeam(feed)).toBe("466.l.123.t.7");
    expect(tradingTeam({ transactions: [] })).toBeUndefined();
  });
});

describe("paths", () => {
  it("builds the D3 and D7 forms the retrieval plan names", () => {
    expect(gameLogsPath("466.l.123", ["466.p.1", "466.p.2"])).toBe(
      "/league/466.l.123/players;player_keys=466.p.1,466.p.2;out=game_log"
    );
    expect(teamTransactionsPath("466.l.123", "466.l.123.t.4")).toBe(
      "/league/466.l.123/transactions;types=add,drop,trade;team_key=466.l.123.t.4"
    );
  });
});

describe("summaries", () => {
  it("counts returned, live and missing players", () => {
    expect(
      gameLogsSummary(
        ["466.p.1", "466.p.2", "466.p.3"],
        page(player("466.p.1", 1), player("466.p.2", 0))
      )
    ).toBe("asked 3 players, got 2; 1 with a live game; missing: 466.p.3");
  });

  it("counts transactions by type and those without the team", () => {
    const feed = {
      transactions: {
        0: transaction("trade", "466.l.123.t.4"),
        1: transaction("add", "466.l.123.t.5"),
      },
    };

    expect(transactionsSummary("466.l.123.t.4", feed)).toBe(
      "2 transactions (trade 1, add 1); 1 without 466.l.123.t.4"
    );
  });

  it("writes a README section per call", () => {
    const readme = liveCallsReadme("466.l.123", [
      {
        label: "D3",
        file: "d3.json",
        path: "/x",
        status: 200,
        at: "2026-11-11T01:00:00Z",
        summary: "ok",
      },
    ]);

    expect(readme).toContain("## D3");
    expect(readme).toContain("2026-11-11T01:00:00Z: HTTP 200; ok");
  });
});
