/**
 * Stat lines for the fixture league: deterministic numbers from the player and
 * the date, and every kind of missing value where the player's day calls for it.
 */
import type { NbaGame } from "../../../shared/api/daily-stats-values";
import type { StatPeriod } from "../../../shared/api/daily-stats";
import {
  daysBetween,
  measured,
  missing,
  missingLine,
  type CountValue,
  type MissingKind,
  type StatLine,
} from "../../../shared/domain";
import type { FixturePlayer } from "./fixture-players";

const EPOCH = "2026-01-01";

function seedOf(player: FixturePlayer, date: string): number {
  return Math.abs(player.number * 31 + daysBetween(EPOCH, date) * 17);
}

/** A believable line, with makes never above attempts; `games` scales it to a period. */
function measuredLine(seed: number, games = 1): StatLine {
  const fga = 6 + (seed % 9);
  const fgm = Math.floor(fga * (0.38 + (seed % 5) * 0.04));
  const fta = seed % 6;
  const ftm = Math.max(0, fta - (seed % 2));
  const tpm = Math.min(fgm, seed % 4);
  const scaled = (value: number) => measured(value * games);
  return {
    fg: measured({ makes: fgm * games, attempts: fga * games }),
    ft: measured({ makes: ftm * games, attempts: fta * games }),
    tpm: scaled(tpm),
    pts: scaled(2 * fgm + tpm + ftm),
    reb: scaled(2 + (seed % 8)),
    ast: scaled(1 + (seed % 7)),
    stl: scaled(seed % 3),
    blk: scaled((seed >> 1) % 3),
    to: scaled(seed % 4),
  };
}

/** Why the player has no line that date, or null when they played. */
function missingKind(
  player: FixturePlayer,
  game: NbaGame | null,
  isToday: boolean
): MissingKind | null {
  if (game === null) {
    return "noGame";
  }
  if (game.state.kind === "scheduled") {
    return "notYetPlayed";
  }
  if (player.role === "out" || (player.role === "sitsOutToday" && isToday)) {
    return "didNotPlay";
  }
  return player.role === "unavailableToday" && isToday ? "unavailable" : null;
}

/** The player's line on `date`, given their team's game that date. */
export function lineOn(
  player: FixturePlayer,
  date: string,
  game: NbaGame | null,
  today: string
): StatLine {
  const kind = missingKind(player, game, date === today);
  return kind === null ? measuredLine(seedOf(player, date)) : missingLine(kind);
}

/** The player's minutes in `game`. */
export function minutesIn(player: FixturePlayer, game: NbaGame, today: string): CountValue {
  const kind = missingKind(player, game, game.date === today);
  return kind === null ? measured(18 + (seedOf(player, game.date) % 20)) : missing(kind);
}

const GAMES_PLAYED: Readonly<Record<StatPeriod, number>> = { season: 12, last7: 3, last30: 12 };

/** The player's totals for a period; a player who is out hasn't played any games. */
export function periodTotals(
  player: FixturePlayer,
  period: StatPeriod
): { gamesPlayed: number; line: StatLine } {
  if (player.role === "out") {
    return { gamesPlayed: 0, line: missingLine("didNotPlay") };
  }
  const gamesPlayed = GAMES_PLAYED[period];
  return { gamesPlayed, line: measuredLine(player.number * 13, gamesPlayed) };
}
