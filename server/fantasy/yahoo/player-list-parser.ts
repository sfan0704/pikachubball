import { z } from "zod";
import { PLAYER_PAGE_SIZE, type PlayerListQuery } from "../../../shared/api/daily-stats";
import {
  dateSchema,
  nbaTeamSchema,
  playerKeySchema,
  teamKeySchema,
} from "../../../shared/api/daily-stats-values";
import type { PlayerPage } from "../daily-stats-source";
import { fragments, indexed, leagueSection, parseYahoo } from "../yahoo-shapes";

/*
 * D5: one page of `/league/{L}/players;…;out=ownership,percent_owned`, shapes
 * as recorded in FAN-95. Each player is a list: its property fragments, then
 * `{ ownership }`, then `{ percent_owned }`; merging them gives one object.
 */

const STATUS = { available: "A", owned: "T", waivers: "W" } as const;
const SORT = { actualRank: "AR", overallRank: "OR" } as const;

/** Yahoo's search matches plain letters, so "Dončić" is sent as "Doncic". */
function plainLetters(text: string): string {
  return text.normalize("NFD").replace(/\p{Mark}/gu, "");
}

/** The Yahoo path for one page of the player list. */
export function playerListPath(leagueKey: string, query: PlayerListQuery): string {
  const filters = [
    `status=${STATUS[query.status]}`,
    query.position === undefined ? null : `position=${query.position}`,
    query.search === undefined ? null : `search=${encodeURIComponent(plainLetters(query.search))}`,
    `sort=${SORT[query.sort]}`,
    `start=${query.start}`,
    `count=${PLAYER_PAGE_SIZE}`,
    "out=ownership,percent_owned",
  ].filter((filter) => filter !== null);
  return `/league/${leagueKey}/players;${filters.join(";")}`;
}

const ownership = z
  .discriminatedUnion("ownership_type", [
    z.object({
      ownership_type: z.literal("team"),
      owner_team_key: teamKeySchema,
      owner_team_name: z.string().min(1),
    }),
    z.object({ ownership_type: z.literal("freeagents") }),
    z.object({ ownership_type: z.literal("waivers"), waiver_date: dateSchema }),
  ])
  .transform((owner): PlayerPage["players"][number]["ownership"] => {
    switch (owner.ownership_type) {
      case "team":
        return { kind: "team", teamKey: owner.owner_team_key, teamName: owner.owner_team_name };
      case "waivers":
        return { kind: "waivers", clearsOn: owner.waiver_date };
      case "freeagents":
        return { kind: "freeAgent" };
    }
  });

/** Percentage points, sent as a number or as text such as "-15" or "2.5". */
const percentPoints = z.union([
  z.number(),
  z
    .string()
    .regex(/^[+-]?\d+(\.\d+)?$/, "must be a number")
    .transform(Number),
]);

/** Yahoo leaves `value` out for players under 1%; that is null ("<1%"), never 0. */
const percentOwned = fragments(
  z.object({
    coverage_type: z.literal("week"),
    week: z.coerce.number().int().positive(),
    value: percentPoints.pipe(z.number().min(0).max(100)).optional(),
    delta: percentPoints,
  })
).transform(({ week, value, delta }) => ({ week, percent: value ?? null, change: delta }));

const injury = (status: string | undefined, note: string | undefined) =>
  status === undefined ? null : { designation: status, reason: note ?? null };

const listedPlayer = z.object({
  player: fragments(
    z.object({
      player_key: playerKeySchema,
      name: z.object({ full: z.string().min(1) }),
      editorial_team_abbr: nbaTeamSchema,
      display_position: z.string().min(1),
      /** GTD, O, NA (not active) and so on; absent when healthy. */
      status: z.string().min(1).optional(),
      injury_note: z.string().min(1).optional(),
      ownership,
      percent_owned: percentOwned,
    })
  ).transform((player): PlayerPage["players"][number] => ({
    player: {
      playerKey: player.player_key,
      name: player.name.full,
      nbaTeam: player.editorial_team_abbr,
      positions: player.display_position.split(","),
      injuryToday: injury(player.status, player.injury_note),
    },
    ownership: player.ownership,
    rostered: player.percent_owned,
  })),
});

/** An empty page is `players: []`; a full one is Yahoo's indexed collection. */
const listedPlayers = z.union([
  z.array(z.never()).length(0),
  indexed(listedPlayer.transform(({ player }) => player)),
]);

const playerListBody = z.object({
  fantasy_content: z.object({ league: z.array(z.unknown()) }),
});

/** One page of the list, read from Yahoo's body; `fetchedAt` is stamped by the service. */
export function parsePlayerPage(body: unknown, start: number): PlayerPage {
  const sections = parseYahoo(playerListBody, body).fantasy_content.league;
  const players = parseYahoo(listedPlayers, leagueSection(sections, "players"));
  return { start, hasMore: players.length === PLAYER_PAGE_SIZE, players };
}
