import { describe, expect, it } from "vitest";
import {
  backedOffInterval,
  followsLineup,
  FRESHNESS_POLICY,
  freshnessClass,
  freshnessOf,
  liveSignal,
  type DailyDataset,
  type GameState,
} from "../../../shared/domain";

const MINUTE = 60_000;
const TODAY = "2026-11-11";
const NOW = Date.parse("2026-11-12T01:00:00Z"); // 8 pm Eastern on TODAY

const scheduled = (tipOff: string): GameState => ({ kind: "scheduled", tipOff });
const live: GameState = {
  kind: "live",
  tipOff: "2026-11-12T00:30:00Z",
  progress: { kind: "text", text: "Halftime" },
};
const final: GameState = {
  kind: "final",
  tipOff: "2026-11-11T23:00:00Z",
  result: "W",
  ownScore: 110,
  opponentScore: 101,
};

describe("freshness policy table", () => {
  it("has four classes with the agreed timers", () => {
    expect(FRESHNESS_POLICY).toEqual({
      live: { freshFor: 2 * MINUTE, pollEvery: 2 * MINUTE },
      recent: { freshFor: 10 * MINUTE, pollEvery: null },
      daily: { freshFor: 6 * 60 * MINUTE, pollEvery: null },
      settled: { freshFor: Number.POSITIVE_INFINITY, pollEvery: null },
    });
  });

  it("puts each fixed dataset in its class", () => {
    const classes = (
      [
        "gameLogs",
        "playerStats",
        "playerList",
        "schedule",
        "transactions",
        "draft",
        "roster",
        "weeks",
      ] as const
    ).map((kind) => [kind, freshnessClass({ kind }, TODAY)]);
    expect(Object.fromEntries(classes)).toEqual({
      gameLogs: "live",
      playerStats: "daily",
      playerList: "recent",
      schedule: "daily",
      transactions: "recent",
      draft: "settled",
      roster: "recent",
      weeks: "settled",
    });
  });

  it("keeps the current week and season live and settles earlier weeks (D1)", () => {
    expect(freshnessClass({ kind: "weekTable", scope: "current" }, TODAY)).toBe("live");
    expect(freshnessClass({ kind: "weekTable", scope: "season" }, TODAY)).toBe("live");
    expect(freshnessClass({ kind: "weekTable", scope: "past" }, TODAY)).toBe("settled");
  });

  it("refetches only the current week on every return to the tab, because games left follow the lineup", () => {
    expect(followsLineup({ kind: "weekTable", scope: "current" })).toBe(true);
    expect(followsLineup({ kind: "weekTable", scope: "season" })).toBe(false);
    expect(followsLineup({ kind: "weekTable", scope: "past" })).toBe(false);
    expect(followsLineup({ kind: "roster" })).toBe(false);
  });

  it("times a team day by how long ago it was (D2)", () => {
    const dayClass = (date: string) => freshnessClass({ kind: "teamDay", date }, TODAY);
    expect(dayClass("2026-11-12")).toBe("recent");
    expect(dayClass("2026-11-11")).toBe("live");
    expect(dayClass("2026-11-10")).toBe("recent");
    expect(dayClass("2026-11-09")).toBe("recent");
    expect(dayClass("2026-11-08")).toBe("settled");
    expect(dayClass("2026-10-22")).toBe("settled");
  });

  it("counts day boundaries across a month end", () => {
    const dayClass = (date: string) => freshnessClass({ kind: "teamDay", date }, "2026-12-01");
    expect(dayClass("2026-11-29")).toBe("recent");
    expect(dayClass("2026-11-28")).toBe("settled");
  });

  it("treats Live as Recent while no shown game is live", () => {
    const today: DailyDataset = { kind: "teamDay", date: TODAY };
    expect(freshnessOf(today, TODAY, true)).toEqual(FRESHNESS_POLICY.live);
    expect(freshnessOf(today, TODAY, false)).toEqual(FRESHNESS_POLICY.recent);
    expect(freshnessOf({ kind: "draft" }, TODAY, true)).toEqual(FRESHNESS_POLICY.settled);
    expect(freshnessOf({ kind: "schedule" }, TODAY, true)).toEqual(FRESHNESS_POLICY.daily);
  });
});

describe("rate-limit backoff", () => {
  it("doubles the poll interval to at most ten minutes", () => {
    expect([0, 1, 2, 3, 4].map((polls) => backedOffInterval(2 * MINUTE, polls))).toEqual([
      2 * MINUTE,
      4 * MINUTE,
      8 * MINUTE,
      10 * MINUTE,
      10 * MINUTE,
    ]);
  });
});

describe("games live now", () => {
  it("is off with no games, and with only finished or idle ones", () => {
    expect(liveSignal([], NOW)).toEqual({ gamesLive: false, changesAt: null });
    expect(liveSignal([final, { kind: "noGame" }], NOW)).toEqual({
      gamesLive: false,
      changesAt: null,
    });
  });

  it("is on while Yahoo flags a game live", () => {
    expect(liveSignal([final, live], NOW).gamesLive).toBe(true);
  });

  it("is on once a tip-off passes without a final, for four hours at most", () => {
    const tipOff = "2026-11-12T00:30:00Z";
    expect(liveSignal([scheduled(tipOff)], NOW)).toEqual({
      gamesLive: true,
      changesAt: Date.parse(tipOff) + 4 * 60 * MINUTE,
    });
    expect(liveSignal([scheduled(tipOff)], Date.parse(tipOff) + 4 * 60 * MINUTE)).toEqual({
      gamesLive: false,
      changesAt: null,
    });
  });

  it("names the next shown tip-off, so polling turns back on then", () => {
    const signal = liveSignal(
      [final, scheduled("2026-11-12T03:00:00Z"), scheduled("2026-11-12T02:00:00Z")],
      NOW
    );
    expect(signal).toEqual({ gamesLive: false, changesAt: Date.parse("2026-11-12T02:00:00Z") });
    expect(liveSignal([scheduled("2026-11-12T02:00:00Z")], signal.changesAt ?? 0).gamesLive).toBe(
      true
    );
  });
});
