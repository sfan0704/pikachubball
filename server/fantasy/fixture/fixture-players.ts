/**
 * The fantasy side of the fixture league: 14 teams with the same roster shape,
 * a dropped player each on waivers, and a pool of free agents. Between them
 * they cover every player state the daily-stats screens show.
 */
import type { DailyPlayer } from "../../../shared/api/daily-stats-values";

/** The fixture league has 14 teams, like the recorded league. */
export const FIXTURE_TEAM_COUNT = 14;

/** How the player's day goes when their team plays. */
export type Role =
  | "plays"
  /** Sat out today's finished game. */
  | "sitsOutToday"
  /** Today's line couldn't be read. */
  | "unavailableToday"
  /** Out for every game. */
  | "out";

/** A player in the fixture league. */
export interface FixturePlayer {
  readonly number: number;
  readonly player: DailyPlayer;
  readonly role: Role;
}

/** One roster slot of every fixture team. */
interface SlotTemplate {
  readonly slot: string;
  readonly nbaTeam: string;
  readonly positions: readonly string[];
  readonly role: Role;
  readonly injury?: DailyPlayer["injuryToday"];
}

/** Slot 10 is the player each team added two days ago; slot 11 came off waivers. */
export const ADDED_SLOT = 10;
export const CLAIMED_SLOT = 11;
const DROPPED_OFFSET = 50;

const SLOTS: readonly SlotTemplate[] = [
  { slot: "PG", nbaTeam: "BOS", positions: ["PG", "SG"], role: "plays" },
  { slot: "SG", nbaTeam: "LAL", positions: ["SG"], role: "plays" },
  {
    slot: "G",
    nbaTeam: "DEN",
    positions: ["PG"],
    role: "plays",
    injury: { designation: "GTD", reason: "Ankle" },
  },
  { slot: "SF", nbaTeam: "PHX", positions: ["SF"], role: "plays" },
  { slot: "PF", nbaTeam: "GSW", positions: ["PF", "C"], role: "sitsOutToday" },
  { slot: "F", nbaTeam: "NYK", positions: ["SF", "PF"], role: "unavailableToday" },
  { slot: "C", nbaTeam: "MIA", positions: ["C"], role: "plays" },
  { slot: "C", nbaTeam: "DAL", positions: ["C"], role: "plays" },
  { slot: "Util", nbaTeam: "BOS", positions: ["SG", "SF"], role: "plays" },
  { slot: "Util", nbaTeam: "LAL", positions: ["PF"], role: "plays" },
  { slot: "BN", nbaTeam: "GSW", positions: ["PG"], role: "plays" },
  { slot: "BN", nbaTeam: "DEN", positions: ["SF"], role: "plays" },
  {
    slot: "IL",
    nbaTeam: "MIA",
    positions: ["C"],
    role: "out",
    injury: { designation: "O", reason: "Knee" },
  },
];

const FIRST_NAMES = [
  "Avery",
  "Blake",
  "Casey",
  "Devon",
  "Emery",
  "Finley",
  "Gray",
  "Harper",
  "Indy",
  "Jordan",
  "Kendall",
  "Logan",
  "Morgan",
];
const LAST_NAMES = [
  "Ash",
  "Birch",
  "Cedar",
  "Dale",
  "Elm",
  "Fern",
  "Glen",
  "Heath",
  "Ivy",
  "Juniper",
  "Knoll",
  "Lake",
  "Moss",
  "North",
];
const FREE_AGENT_COUNT = 30;
const FREE_AGENT_BASE = 20000;
const NBA_TEAMS = ["BOS", "NYK", "LAL", "GSW", "DEN", "MIA", "PHX", "DAL"];
const FREE_AGENT_POSITIONS = [["PG"], ["SG", "SF"], ["PF"], ["C"], ["SF"]];

function build(
  game: string,
  number: number,
  name: string,
  template: Omit<SlotTemplate, "slot">
): FixturePlayer {
  return {
    number,
    role: template.role,
    player: {
      playerKey: `${game}.p.${number}`,
      name,
      nbaTeam: template.nbaTeam,
      positions: [...template.positions],
      injuryToday: template.injury ?? null,
    },
  };
}

/** Team `team`'s player in slot `slot` (1 to 13). */
export function rosterPlayer(game: string, team: number, slot: number): FixturePlayer {
  const template = SLOTS[slot - 1];
  const name = `${FIRST_NAMES[slot - 1]} ${LAST_NAMES[team - 1]}`;
  return build(game, 10000 + team * 100 + slot, name, template);
}

/** The player team `team` dropped two days ago for its slot-10 player; now on waivers. */
export function droppedPlayer(game: string, team: number): FixturePlayer {
  const name = `Quinn ${LAST_NAMES[team - 1]}`;
  return build(game, 10000 + team * 100 + DROPPED_OFFSET, name, {
    nbaTeam: "DAL",
    positions: ["SG"],
    role: "plays",
  });
}

/** The free agents; the last one hasn't played this season. */
export function freeAgents(game: string): FixturePlayer[] {
  return Array.from({ length: FREE_AGENT_COUNT }, (_, index) => {
    const number = FREE_AGENT_BASE + index + 1;
    return build(game, number, `${FIRST_NAMES[index % 13]} Rivers ${index + 1}`, {
      nbaTeam: NBA_TEAMS[index % NBA_TEAMS.length],
      positions: FREE_AGENT_POSITIONS[index % FREE_AGENT_POSITIONS.length],
      role: index === FREE_AGENT_COUNT - 1 ? "out" : "plays",
    });
  });
}

/** The slot templates' names and whether each counts. */
export function slotOf(slot: number): { slot: string; isStartingSlot: boolean } {
  const name = SLOTS[slot - 1].slot;
  return { slot: name, isStartingSlot: name !== "BN" && name !== "IL" };
}

/** Roster slots per team. */
export const ROSTER_SIZE = SLOTS.length;

/** Every player the fixture league knows: rosters, dropped players and free agents. */
export function allPlayers(game: string): FixturePlayer[] {
  const teams = Array.from({ length: FIXTURE_TEAM_COUNT }, (_, index) => index + 1);
  return [
    ...teams.flatMap((team) =>
      Array.from({ length: ROSTER_SIZE }, (_, index) => rosterPlayer(game, team, index + 1))
    ),
    ...teams.map((team) => droppedPlayer(game, team)),
    ...freeAgents(game),
  ];
}

/** The team a fixture player is rostered on now, or null for free agents and waiver players. */
export function teamOf(number: number): number | null {
  const team = Math.floor((number - 10000) / 100);
  const slot = number - 10000 - team * 100;
  return number < FREE_AGENT_BASE && slot >= 1 && slot <= ROSTER_SIZE ? team : null;
}

/** Whether a fixture player is on waivers. */
export function isOnWaivers(number: number): boolean {
  return number < FREE_AGENT_BASE && (number - 10000) % 100 === DROPPED_OFFSET;
}
