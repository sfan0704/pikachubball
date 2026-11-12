import { describe, expect, it } from "vitest";
import {
  appearance,
  isLive,
  lineWithGame,
  measured,
  missing,
  missingLine,
  sumLines,
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

describe("sumLines", () => {
  it("adds counts and makes/attempts, so percentages come from the sums", () => {
    const total = sumLines([
      buildStatLine({ fg: measured({ makes: 6, attempts: 13 }), pts: measured(17) }),
      missingLine("noGame"),
      buildStatLine({ fg: measured({ makes: 3, attempts: 7 }), pts: measured(0) }),
    ]);

    expect(total.fg).toEqual(measured({ makes: 9, attempts: 20 }));
    expect(total.pts).toEqual(measured(17));
  });

  it("makes a field unavailable when any game's value is unavailable", () => {
    const total = sumLines([buildStatLine(), missingLine("unavailable")]);

    expect(total.reb).toEqual(missing("unavailable"));
    expect(total.ft).toEqual(missing("unavailable"));
  });

  it("keeps a week without a measured game missing, never 0", () => {
    expect(sumLines([])).toEqual(missingLine("noGame"));
    expect(sumLines([missingLine("noGame"), missingLine("notYetPlayed")])).toEqual(
      missingLine("notYetPlayed")
    );
    expect(sumLines([missingLine("notYetPlayed"), missingLine("didNotPlay")])).toEqual(
      missingLine("didNotPlay")
    );
  });
});

describe("lineWithGame", () => {
  const tipOff = "2026-11-08T00:00:00.000Z";
  const noGame = missingLine("noGame");

  it("reads a no-game line as not yet played when the game is scheduled or live", () => {
    expect(lineWithGame(noGame, { kind: "scheduled", tipOff })).toEqual(
      missingLine("notYetPlayed")
    );
    const progress = { kind: "text", text: "Halftime" } as const;
    expect(lineWithGame(noGame, { kind: "live", tipOff, progress })).toEqual(
      missingLine("notYetPlayed")
    );
  });

  it("keeps the line when there is no game, the game is over, or the game is unknown", () => {
    const final = { kind: "final", tipOff, result: "W", ownScore: 1, opponentScore: 0 } as const;
    for (const game of [null, undefined, { kind: "noGame" } as const, final]) {
      expect(lineWithGame(noGame, game)).toBe(noGame);
    }
  });

  it("never touches a line with a measured value or another missing kind", () => {
    const scheduled = { kind: "scheduled", tipOff } as const;
    const played = buildStatLine();
    expect(lineWithGame(played, scheduled)).toBe(played);
    const unavailable = missingLine("unavailable");
    expect(lineWithGame(unavailable, scheduled)).toBe(unavailable);
  });
});
