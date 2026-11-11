import { describe, expect, it } from "vitest";
import { latestAcquisition, type DraftResults, type TeamMove } from "../../../shared/domain";

const TEAM = "466.l.1.t.3";
const OTHER = "466.l.1.t.7";
const PLAYER = "466.p.100";

const snake: DraftResults = {
  isAuction: false,
  picks: [{ round: 4, teamKey: TEAM, playerKey: PLAYER, cost: null }],
};
const auction: DraftResults = {
  isAuction: true,
  picks: [{ round: 1, teamKey: TEAM, playerKey: PLAYER, cost: 42 }],
};
const noDraft: DraftResults = { isAuction: false, picks: [] };

function move(from: TeamMove["players"][number]["from"], to = TEAM, bid: number | null = null) {
  return {
    waiverBid: bid,
    players: [{ playerKey: PLAYER, from, to: { kind: "team", teamKey: to } as const }],
  };
}

describe("latestAcquisition", () => {
  it("names the draft round in a snake draft and the price in an auction", () => {
    expect(latestAcquisition(PLAYER, TEAM, [], snake)).toEqual({ kind: "drafted", round: 4 });
    expect(latestAcquisition(PLAYER, TEAM, [], auction)).toEqual({ kind: "auction", cost: 42 });
  });

  it("names a waiver claim with its bid, a free-agent add and a trade", () => {
    expect(latestAcquisition(PLAYER, TEAM, [move({ kind: "waivers" }, TEAM, 7)], snake)).toEqual({
      kind: "waivers",
      bid: 7,
    });
    expect(latestAcquisition(PLAYER, TEAM, [move({ kind: "freeAgents" })], snake)).toEqual({
      kind: "freeAgent",
    });
    expect(
      latestAcquisition(PLAYER, TEAM, [move({ kind: "team", teamKey: OTHER })], noDraft)
    ).toEqual({ kind: "trade" });
  });

  it("lets the newest move win over older moves and the draft", () => {
    const dropped = {
      waiverBid: null,
      players: [
        {
          playerKey: PLAYER,
          from: { kind: "team", teamKey: TEAM } as const,
          to: { kind: "waivers" } as const,
        },
      ],
    };
    const readded = move({ kind: "freeAgents" });
    expect(latestAcquisition(PLAYER, TEAM, [readded, dropped], snake)).toEqual({
      kind: "freeAgent",
    });
  });

  it("is unknown when nothing explains the player, or the newest move took them away", () => {
    expect(latestAcquisition(PLAYER, TEAM, [], noDraft)).toEqual({ kind: "unknown" });
    expect(
      latestAcquisition(PLAYER, TEAM, [], {
        isAuction: false,
        picks: [{ round: 2, teamKey: OTHER, playerKey: PLAYER, cost: null }],
      })
    ).toEqual({ kind: "unknown" });
    expect(latestAcquisition(PLAYER, TEAM, [move({ kind: "freeAgents" }, OTHER)], snake)).toEqual({
      kind: "unknown",
    });
  });
});
