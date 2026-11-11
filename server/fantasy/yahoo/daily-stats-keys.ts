import { ValidationError } from "../../../shared/api/errors";
import {
  dateSchema,
  leagueKeySchema,
  playerKeySchema,
  teamKeySchema,
} from "../../../shared/api/daily-stats-values";

/*
 * Keys go into Yahoo paths, so each is checked before any call: a key from
 * another league or season is VALIDATION_ERROR without asking Yahoo.
 */

function gameOf(key: string): string {
  return key.slice(0, key.indexOf("."));
}

/** The league key, or VALIDATION_ERROR when it isn't one. */
export function checkLeagueKey(leagueKey: string): string {
  if (!leagueKeySchema.safeParse(leagueKey).success) {
    throw new ValidationError("Invalid league key");
  }
  return leagueKey;
}

/** The team key, or VALIDATION_ERROR unless it is a team of this league. */
export function checkTeamKey(leagueKey: string, teamKey: string): string {
  checkLeagueKey(leagueKey);
  if (!teamKeySchema.safeParse(teamKey).success || !teamKey.startsWith(`${leagueKey}.t.`)) {
    throw new ValidationError("Team is not in this league");
  }
  return teamKey;
}

/** The player keys, or VALIDATION_ERROR unless there is at least one and each is from the league's game. */
export function checkPlayerKeys(leagueKey: string, playerKeys: readonly string[]): string[] {
  checkLeagueKey(leagueKey);
  const game = gameOf(leagueKey);
  const valid = playerKeys.every(
    (key) => playerKeySchema.safeParse(key).success && gameOf(key) === game
  );
  if (playerKeys.length === 0 || !valid) {
    throw new ValidationError("Players must be from this league's season");
  }
  return [...playerKeys];
}

/** The date, or VALIDATION_ERROR unless it is YYYY-MM-DD. */
export function checkDate(date: string): string {
  if (!dateSchema.safeParse(date).success) {
    throw new ValidationError("Invalid date");
  }
  return date;
}
