/**
 * The league-level datasets of the fixture league: the player pool pages, a
 * team's moves, the draft and the scoring weeks.
 */
import type { PlayerListQuery } from "../../../shared/api/daily-stats";
import { PLAYER_PAGE_SIZE } from "../../../shared/api/daily-stats";
import { addDays, mondayOf } from "../../../shared/domain";
import type { Draft, PlayerPage, Transactions, Weeks } from "../daily-stats-source";
import {
  ADDED_SLOT,
  CLAIMED_SLOT,
  FIXTURE_TEAM_COUNT,
  allPlayers,
  droppedPlayer,
  isOnWaivers,
  rosterPlayer,
  teamOf,
  type FixturePlayer,
} from "./fixture-players";

/** The scoring week that contains today; the fixture season has 20. */
const CURRENT_WEEK = 5;
const WEEK_COUNT = 20;

/** The fixture's team names, as the recorded league names them. */
export function teamName(team: number): string {
  return `Team ${team}`;
}

function ownershipOf(
  league: string,
  number: number,
  today: string
): PlayerPage["players"][number]["ownership"] {
  const team = teamOf(number);
  if (team !== null) {
    return { kind: "team", teamKey: `${league}.t.${team}`, teamName: teamName(team) };
  }
  return isOnWaivers(number)
    ? { kind: "waivers", clearsOn: addDays(today, 1) }
    : { kind: "freeAgent" };
}

const COMPOSITE: Readonly<Record<string, readonly string[]>> = {
  G: ["PG", "SG"],
  F: ["SF", "PF"],
};

function matches(player: FixturePlayer, query: PlayerListQuery): boolean {
  const owned = teamOf(player.number) !== null;
  const status =
    query.status === "owned"
      ? owned
      : query.status === "waivers"
        ? isOnWaivers(player.number)
        : !owned;
  const wanted = query.position ? (COMPOSITE[query.position] ?? [query.position]) : null;
  const position = wanted === null || player.player.positions.some((p) => wanted.includes(p));
  const search =
    query.search === undefined ||
    player.player.name.toLowerCase().includes(query.search.toLowerCase());
  return status && position && search;
}

/** Yahoo's two rankings, as two fixed orders over the pool. */
function rankKey(player: FixturePlayer, sort: PlayerListQuery["sort"]): number {
  return sort === "actualRank" ? player.number : (player.number * 7919) % 10007;
}

/** One page of the pool, filtered and sorted like Yahoo's list. */
export function playerPage(league: string, query: PlayerListQuery, today: string): PlayerPage {
  const game = league.slice(0, league.indexOf("."));
  const page = allPlayers(game)
    .filter((player) => matches(player, query))
    .sort((a, b) => rankKey(a, query.sort) - rankKey(b, query.sort))
    .slice(query.start, query.start + PLAYER_PAGE_SIZE);
  return {
    start: query.start,
    hasMore: page.length === PLAYER_PAGE_SIZE,
    players: page.map((player) => ({
      player: player.player,
      ownership: ownershipOf(league, player.number, today),
      rostered: {
        week: CURRENT_WEEK,
        percent: player.number % 10 === 0 ? null : (player.number % 97) + 1,
        change: (player.number % 7) - 3,
      },
    })),
  };
}

/** The team's two moves: an add/drop two days ago and a waiver claim before that. */
export function teamMoves(league: string, team: number, today: string): Transactions {
  const game = league.slice(0, league.indexOf("."));
  const teamKey = `${league}.t.${team}`;
  return {
    teamKey,
    transactions: [
      {
        transactionKey: `${league}.tr.${team * 10 + 2}`,
        kind: "addDrop",
        at: `${addDays(today, -2)}T18:00:00.000Z`,
        waiverBid: null,
        players: [
          {
            playerKey: rosterPlayer(game, team, ADDED_SLOT).player.playerKey,
            move: "add",
            from: { kind: "freeAgents" },
            to: { kind: "team", teamKey },
          },
          {
            playerKey: droppedPlayer(game, team).player.playerKey,
            move: "drop",
            from: { kind: "team", teamKey },
            to: { kind: "waivers" },
          },
        ],
      },
      {
        transactionKey: `${league}.tr.${team * 10 + 1}`,
        kind: "add",
        at: `${addDays(today, -6)}T09:00:00.000Z`,
        waiverBid: 4,
        players: [
          {
            playerKey: rosterPlayer(game, team, CLAIMED_SLOT).player.playerKey,
            move: "add",
            from: { kind: "waivers" },
            to: { kind: "team", teamKey },
          },
        ],
      },
    ],
  };
}

/** The slots each team filled at the draft; the others came later. */
const DRAFTED_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13];

/** A snake draft: each round reverses the order of the one before. */
export function snakeDraft(league: string): Draft {
  const game = league.slice(0, league.indexOf("."));
  const picks = DRAFTED_SLOTS.flatMap((slot, index) => {
    const round = index + 1;
    return Array.from({ length: FIXTURE_TEAM_COUNT }, (_, position) => {
      const team = round % 2 === 1 ? position + 1 : FIXTURE_TEAM_COUNT - position;
      return {
        pick: index * FIXTURE_TEAM_COUNT + position + 1,
        round,
        teamKey: `${league}.t.${team}`,
        playerKey: rosterPlayer(game, team, slot).player.playerKey,
        cost: null,
      };
    });
  });
  return { isAuction: false, picks };
}

/** Monday-to-Sunday weeks, numbered so today falls in week 5. */
export function scoringWeeks(today: string): Weeks {
  const current = mondayOf(today);
  return {
    weeks: Array.from({ length: WEEK_COUNT }, (_, index) => {
      const start = addDays(current, (index + 1 - CURRENT_WEEK) * 7);
      return { week: index + 1, start, end: addDays(start, 6) };
    }),
  };
}
