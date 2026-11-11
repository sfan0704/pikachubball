import { describe, expect, it } from "vitest";
import {
  appearance,
  isLive,
  measured,
  missing,
  missingLine,
  type GameState,
  type MissingKind,
} from "../../../shared/domain";
import { buildStatLine } from "../../support/builders";

describe("stat values", () => {
  it("keeps each missing kind distinct from a measured zero", () => {
    const kinds: MissingKind[] = ["noGame", "didNotPlay", "notYetPlayed", "unavailable"];
    for (const kind of kinds) {
      expect(missing(kind)).toEqual({ kind });
      expect(missing(kind)).not.toEqual(measured(0));
    }
    expect(measured(0)).toEqual({ kind: "value", value: 0 });
  });

  it("keeps both parts of a makes/attempts pair", () => {
    expect(measured({ makes: 7, attempts: 13 })).toEqual({
      kind: "value",
      value: { makes: 7, attempts: 13 },
    });
  });
});

describe("appearance", () => {
  it("is played when any value was measured, even a zero", () => {
    expect(appearance(buildStatLine())).toBe("played");
    expect(appearance({ ...missingLine("unavailable"), pts: measured(0) })).toBe("played");
  });

  it.each(["noGame", "didNotPlay", "notYetPlayed", "unavailable"] as const)(
    "is %s when the whole line says so",
    (kind) => {
      expect(appearance(missingLine(kind))).toBe(kind);
    }
  );

  it("is unavailable when missing kinds disagree", () => {
    expect(appearance({ ...missingLine("noGame"), reb: missing("notYetPlayed") })).toBe(
      "unavailable"
    );
  });
});

describe("game state", () => {
  const states: Record<GameState["kind"], GameState> = {
    scheduled: { kind: "scheduled", tipOff: "2026-11-08T23:00:00.000Z" },
    live: {
      kind: "live",
      tipOff: "2026-11-08T23:00:00.000Z",
      progress: { kind: "clock", period: 3, clock: "7:48", ownScore: 77, opponentScore: 70 },
    },
    final: {
      kind: "final",
      tipOff: "2026-11-08T23:00:00.000Z",
      result: "W",
      ownScore: 126,
      opponentScore: 107,
    },
    noGame: { kind: "noGame" },
  };

  it("is live only while a game is in progress", () => {
    expect(isLive(states.live)).toBe(true);
    expect(isLive(states.scheduled)).toBe(false);
    expect(isLive(states.final)).toBe(false);
    expect(isLive(states.noGame)).toBe(false);
  });

  it("is still live when Yahoo's text couldn't be read", () => {
    expect(
      isLive({
        kind: "live",
        tipOff: "2026-11-08T23:00:00.000Z",
        progress: { kind: "text", text: "Halftime" },
      })
    ).toBe(true);
  });
});
