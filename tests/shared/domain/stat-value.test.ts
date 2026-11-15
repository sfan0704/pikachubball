import { describe, expect, it } from "vitest";
import {
  appearance,
  isLive,
  lineWithGame,
  measured,
  missing,
  missingLine,
  statOf,
  sumLines,
  type GameState,
  type MissingKind,
} from "../../../shared/domain";
import { buildStatLine, STAT } from "../../support/builders";

describe("stat values", () => {
  it("keeps each missing kind distinct from a measured zero", () => {
    const kinds: MissingKind[] = ["noGame", "didNotPlay", "notYetPlayed", "unavailable"];
    for (const kind of kinds) {
      expect(missing(kind)).toEqual({ kind });
      expect(missing(kind)).not.toEqual(measured(0));
    }
    expect(measured(0)).toEqual({ kind: "value", value: 0 });
  });

  it("reads a stat the line doesn't list as the line's missing kind", () => {
    expect(statOf(buildStatLine(), STAT.pts)).toEqual(measured(17));
    expect(statOf(buildStatLine(), "27")).toEqual(missing("unavailable"));
    expect(statOf(missingLine("didNotPlay"), STAT.pts)).toEqual(missing("didNotPlay"));
  });
});

describe("appearance", () => {
  it("is played when any value was measured, even a zero", () => {
    expect(appearance(buildStatLine())).toBe("played");
    expect(appearance({ stats: { [STAT.pts]: measured(0) }, otherwise: "unavailable" })).toBe(
      "played"
    );
  });

  it.each(["noGame", "didNotPlay", "notYetPlayed", "unavailable"] as const)(
    "is %s when the whole line says so",
    (kind) => {
      expect(appearance(missingLine(kind))).toBe(kind);
    }
  );

  it("is unavailable when missing kinds disagree", () => {
    const line = {
      stats: { [STAT.pts]: missing("noGame"), [STAT.reb]: missing("notYetPlayed") },
      otherwise: "unavailable" as const,
    };
    expect(appearance(line)).toBe("unavailable");
    expect(appearance({ stats: { [STAT.pts]: missing("noGame") }, otherwise: "unavailable" })).toBe(
      "noGame"
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
  it("adds each stat, makes and attempts apart, so percentages come from the sums", () => {
    const total = sumLines([
      buildStatLine({ fgm: 6, fga: 13, pts: 17 }),
      missingLine("noGame"),
      buildStatLine({ fgm: 3, fga: 7, pts: 0 }),
    ]);

    expect(statOf(total, STAT.fgm)).toEqual(measured(9));
    expect(statOf(total, STAT.fga)).toEqual(measured(20));
    expect(statOf(total, STAT.pts)).toEqual(measured(17));
    expect(statOf(total, "27")).toEqual(missing("unavailable"));
  });

  it("makes a stat unavailable when any game's value is unavailable", () => {
    const total = sumLines([buildStatLine(), missingLine("unavailable")]);

    expect(statOf(total, STAT.reb)).toEqual(missing("unavailable"));
    expect(statOf(total, STAT.fta)).toEqual(missing("unavailable"));
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
