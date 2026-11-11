/**
 * The state of a player's NBA game on a date, from the side of the player's team.
 */

/** Where a live game is: quarter, clock and score when Yahoo's text could be read, else the text as is. */
export type LiveProgress =
  | {
      readonly kind: "clock";
      /** 1 to 4 for quarters, 5 and up for overtimes. */
      readonly period: number;
      /** Game clock as Yahoo shows it, for example "7:48". */
      readonly clock: string;
      readonly ownScore: number;
      readonly opponentScore: number;
    }
  | {
      /** Halftime, delays and other texts the app doesn't parse are shown as Yahoo wrote them. */
      readonly kind: "text";
      readonly text: string;
    };

/** A player's game on a date. Tip-off times are ISO 8601 UTC. */
export type GameState =
  | { readonly kind: "scheduled"; readonly tipOff: string }
  | { readonly kind: "live"; readonly tipOff: string; readonly progress: LiveProgress }
  | {
      readonly kind: "final";
      readonly tipOff: string;
      readonly result: "W" | "L";
      readonly ownScore: number;
      readonly opponentScore: number;
    }
  | { readonly kind: "noGame" };

/** Whether a game is being played right now. */
export function isLive(state: GameState): boolean {
  return state.kind === "live";
}
