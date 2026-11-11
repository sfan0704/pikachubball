import { z } from "zod";
import { fragments, indexed, parseYahoo, yahooInteger } from "../yahoo-shapes";
import type { Transactions } from "../daily-stats-source";

/*
 * D7: `/league/{L}/transactions;types=add,drop,trade;team_key={T}`. Yahoo
 * writes a player's `transaction_data` as a list for adds and trades but as one
 * object for drops (FAN-96), and keeps vetoed trades in the feed.
 */

type Transaction = Transactions["transactions"][number];
type Place = Transaction["players"][number]["from"];

const SUCCESSFUL = "successful";

const KIND_BY_TYPE = {
  add: "add",
  drop: "drop",
  "add/drop": "addDrop",
  trade: "trade",
} as const;

const headerSchema = z.object({
  transaction_key: z.string().min(1),
  type: z.string(),
  status: z.string(),
  timestamp: yahooInteger,
  faab_bid: yahooInteger.optional(),
});

const placeTypeSchema = z.enum(["freeagents", "waivers", "team"]);

const moveDataSchema = z.object({
  type: z.enum(["add", "drop", "trade"]),
  source_type: placeTypeSchema,
  source_team_key: z.string().optional(),
  destination_type: placeTypeSchema,
  destination_team_key: z.string().optional(),
});

const playerMoveSchema = z.object({
  player: z.tuple([
    fragments(z.object({ player_key: z.string().min(1) })),
    z.object({
      transaction_data: z.union([z.tuple([moveDataSchema]), moveDataSchema]),
    }),
  ]),
});

const playersSchema = z.object({ players: indexed(playerMoveSchema) });

/** Yahoo writes an empty collection as `[]` rather than `{"count": 0}`. */
const collection = <T extends z.ZodTypeAny>(item: T) =>
  z.union([z.tuple([]).transform((): z.infer<T>[] => []), indexed(item)]);

const responseSchema = z.object({
  fantasy_content: z.object({
    league: z.tuple([
      z.unknown(),
      z.object({
        transactions: collection(z.object({ transaction: z.array(z.unknown()).min(1) })),
      }),
    ]),
  }),
});

function toPlace(type: z.infer<typeof placeTypeSchema>, teamKey: string | undefined): Place {
  if (type === "freeagents") {
    return { kind: "freeAgents" };
  }
  if (type === "waivers") {
    return { kind: "waivers" };
  }
  return { kind: "team", teamKey: parseYahoo(z.string().min(1), teamKey) };
}

function toPlayerMove(entry: z.infer<typeof playerMoveSchema>): Transaction["players"][number] {
  const [identity, { transaction_data: data }] = entry.player;
  const move = Array.isArray(data) ? data[0] : data;
  return {
    playerKey: identity.player_key,
    move: move.type,
    from: toPlace(move.source_type, move.source_team_key),
    to: toPlace(move.destination_type, move.destination_team_key),
  };
}

/** A successful add, drop or trade; null for a move that didn't happen (vetoed, pending). */
function toTransaction(parts: readonly unknown[]): Transaction | null {
  const header = parseYahoo(headerSchema, parts[0]);
  if (header.status !== SUCCESSFUL) {
    return null;
  }
  const kind = parseYahoo(z.enum(["add", "drop", "add/drop", "trade"]), header.type);
  const { players } = parseYahoo(playersSchema, parts[1]);
  return {
    transactionKey: header.transaction_key,
    kind: KIND_BY_TYPE[kind],
    at: new Date(header.timestamp * 1000).toISOString(),
    waiverBid: header.faab_bid ?? null,
    players: players.map(toPlayerMove),
  };
}

function involves(transaction: Transaction, teamKey: string): boolean {
  return transaction.players.some(({ from, to }) =>
    [from, to].some((place) => place.kind === "team" && place.teamKey === teamKey)
  );
}

/**
 * The team's successful moves, newest first. Yahoo already narrows the feed to
 * the team (FAN-102); moves of other teams are still left out so a wider feed
 * can never credit the team with another team's players.
 */
export function parseTransactions(response: unknown, teamKey: string): Transactions {
  const [, { transactions }] = parseYahoo(responseSchema, response).fantasy_content.league;
  const moves = transactions
    .map(({ transaction }) => toTransaction(transaction))
    .filter((move): move is Transaction => move !== null && involves(move, teamKey))
    .sort((newer, older) => Date.parse(older.at) - Date.parse(newer.at));
  return { teamKey, transactions: moves };
}
