/**
 * The NBA side of the fixture league: four pairs of teams that play each other
 * on a fixed pattern around "today", so every game state appears today.
 */
import type { NbaGame } from "../../../shared/api/daily-stats-values";
import { addDays, daysBetween } from "../../../shared/domain";

/** The fixture's NBA teams, as home/away pairs. */
const PAIRS = [
  ["BOS", "NYK"],
  ["LAL", "GSW"],
  ["DEN", "MIA"],
  ["PHX", "DAL"],
] as const;

/** Every NBA team in the fixture. */
export const FIXTURE_NBA_TEAMS: readonly string[] = PAIRS.flat();

/** How far the fixture's game logs reach back and ahead of today. */
export const LOG_DAYS_BACK = 14;
export const LOG_DAYS_AHEAD = 8;

const FINAL_HOME = 110;
const FINAL_AWAY = 104;

/** Today: the first pair is live, the second final, the third not started, the fourth idle. */
function pairPlays(pair: number, offset: number): boolean {
  if (offset === 0) {
    return pair < 3;
  }
  return Math.abs(offset) % 2 === 0 ? pair < 2 : pair >= 2;
}

/** Home always wins the fixture's finished games. */
function finalState(isHome: boolean, tipOff: string): NbaGame["state"] {
  return {
    kind: "final",
    tipOff,
    result: isHome ? "W" : "L",
    ownScore: isHome ? FINAL_HOME : FINAL_AWAY,
    opponentScore: isHome ? FINAL_AWAY : FINAL_HOME,
  };
}

/** Today's live game: third quarter, home up by four. */
function liveState(isHome: boolean, tipOff: string): NbaGame["state"] {
  const [home, away] = [78, 74];
  return {
    kind: "live",
    tipOff,
    progress: {
      kind: "clock",
      period: 3,
      clock: "7:48",
      ownScore: isHome ? home : away,
      opponentScore: isHome ? away : home,
    },
  };
}

function stateOf(pair: number, offset: number, isHome: boolean, tipOff: string): NbaGame["state"] {
  if (offset < 0 || (offset === 0 && pair === 1)) {
    return finalState(isHome, tipOff);
  }
  return offset === 0 && pair === 0 ? liveState(isHome, tipOff) : { kind: "scheduled", tipOff };
}

/** The game `nbaTeam` plays on `date`, or null when it has none. */
export function fixtureGame(nbaTeam: string, date: string, today: string): NbaGame | null {
  const pair = PAIRS.findIndex((teams) => (teams as readonly string[]).includes(nbaTeam));
  const offset = daysBetween(today, date);
  if (pair < 0 || !pairPlays(pair, offset)) {
    return null;
  }
  const isHome = PAIRS[pair][0] === nbaTeam;
  const tipOff = `${date}T23:30:00.000Z`;
  return {
    gameId: `fx-${date}-${pair}`,
    date,
    opponent: PAIRS[pair][isHome ? 1 : 0],
    isHome,
    state: stateOf(pair, offset, isHome, tipOff),
  };
}

/** The team's games from `from` to `to`, inclusive. */
export function fixtureGames(nbaTeam: string, from: string, to: string, today: string): NbaGame[] {
  const games: NbaGame[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const game = fixtureGame(nbaTeam, date, today);
    if (game) {
      games.push(game);
    }
  }
  return games;
}
