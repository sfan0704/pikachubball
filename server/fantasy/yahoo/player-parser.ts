/**
 * Player Parser
 * Transform raw Yahoo API player responses into domain models
 */

import type { Player, PlayerStatus } from "../../../shared/domain/index.js";
import { logger } from "../../utils/logger.js";

/** One fragment of a Yahoo player: `{ name: {...} }`, `{ status: "O" }` and so on. */
type Fragment = Record<string, unknown>;

function isFragment(value: unknown): value is Fragment {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** The first fragment that has one of the keys. */
function findFragment(fragments: readonly Fragment[], ...keys: string[]): Fragment | undefined {
  return fragments.find((fragment) => keys.some((key) => fragment[key]));
}

function parsePlayerStatus(status: unknown): PlayerStatus {
  const lower = text(status)?.toLowerCase();
  if (lower === "il" || lower === "il+") {
    return "injured";
  }
  return lower === "o" || lower === "gtd" || lower === "inj" ? "out" : "active";
}

function parsePlayerName(name: unknown): string {
  if (typeof name === "string") {
    return name || "Unknown Player";
  }
  if (isFragment(name)) {
    return (
      text(name.full) ??
      (`${text(name.first) ?? ""} ${text(name.last) ?? ""}`.trim() || "Unknown Player")
    );
  }
  return "Unknown Player";
}

/** Position text: display_position ("SF,PF"), else the eligible positions joined. */
function parsePlayerPosition(fragment: Fragment | undefined): string {
  const display = text(fragment?.display_position);
  if (display) {
    return display;
  }
  const eligible = fragment?.eligible_positions;
  if (Array.isArray(eligible) && eligible.length > 0) {
    return eligible.map((entry) => (isFragment(entry) ? String(entry.position) : "")).join(",");
  }
  return "N/A";
}

/** The NBA team's abbreviation, else its full name. */
function parsePlayerNbaTeam(properties: readonly Fragment[]): string {
  return (
    text(findFragment(properties, "editorial_team_abbr")?.editorial_team_abbr) ??
    text(findFragment(properties, "editorial_team_full_name")?.editorial_team_full_name) ??
    "N/A"
  );
}

/** The property fragments of a raw player, or null when the data isn't shaped like a player. */
function propertiesOf(playerData: unknown): Fragment[] | null {
  const properties = Array.isArray(playerData) ? playerData[0] : undefined;
  if (!Array.isArray(properties)) {
    logger.warn("Invalid player data: missing player properties");
    return null;
  }
  if (properties.length === 0) {
    logger.warn("Invalid player data: properties array is empty");
    return null;
  }
  return properties.filter(isFragment);
}

/**
 * Parse Player from Yahoo API player data
 * @param playerData Raw Yahoo API player data
 * @returns Player domain model or null if invalid
 */
export function parsePlayer(playerData: unknown): Player | null {
  const properties = propertiesOf(playerData);
  if (!properties) {
    return null;
  }
  const playerKey = text(findFragment(properties, "player_key")?.player_key);
  if (!playerKey) {
    logger.warn("Invalid player data: player_key not found");
    return null;
  }
  return {
    playerKey,
    name: parsePlayerName(findFragment(properties, "name")?.name),
    position: parsePlayerPosition(
      findFragment(properties, "display_position", "eligible_positions")
    ),
    nbaTeam: parsePlayerNbaTeam(properties),
    status: parsePlayerStatus(findFragment(properties, "status")?.status),
  };
}

/** A property of an object or an item of a list, whichever Yahoo sent. */
function child(value: unknown, key: string | number): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string | number, unknown>)[key]
    : undefined;
}

/**
 * The players of a Yahoo roster response. Yahoo writes the roster as an object
 * keyed "0" (`{ roster: { "0": { players: { count, "0": { player } } } } }`);
 * a list with the same first item reads the same.
 */
export function parsePlayersFromRoster(rosterData: unknown): Player[] {
  const players = child(child(child(rosterData, "roster"), 0), "players");
  const count = Number(child(players, "count"));
  if (!count) {
    logger.warn("Invalid roster data: missing players or count");
    return [];
  }
  return Array.from({ length: count }, (_, index) => child(child(players, String(index)), "player"))
    .filter(Boolean)
    .map((playerData) => parsePlayer(playerData))
    .filter((player): player is Player => player !== null);
}
