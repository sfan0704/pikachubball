import { z } from "zod";
import { dateSchema, nbaTeamSchema, playerKeySchema } from "../../../shared/api/daily-stats-values";
import type { TeamDay } from "../daily-stats-source";
import { fragments, indexed, parseYahoo, YahooResponseError } from "../yahoo-shapes";
import { yahooDateLine } from "./stat-value-parsers";

/**
 * Yahoo's reserved slots that never count for the team. Every other slot,
 * including a league's own (FC, Util), is a starting slot: the settings'
 * `is_starting_position` says the same, and reading it here would cost one
 * more call per team day.
 */
const NON_STARTING_SLOTS: ReadonlySet<string> = new Set(["BN", "IL", "IL+", "NA"]);

const injurySchema = z.object({
  status: z.string().min(1).optional(),
  injury_note: z.string().min(1).optional(),
});

/** One roster player, merged from Yahoo's fragments. */
const rosterPlayerSchema = fragments(
  injurySchema.extend({
    player_key: playerKeySchema,
    name: z.object({ full: z.string().min(1) }),
    editorial_team_abbr: nbaTeamSchema,
    display_position: z.string().min(1),
    selected_position: fragments(z.object({ date: dateSchema, position: z.string().min(1) })),
    player_stats: z.object({ stats: yahooDateLine }),
  })
);

const teamDaySchema = z.object({
  fantasy_content: z.object({
    team: z.tuple([
      fragments(z.object({ team_key: z.string().min(1) })),
      z.object({
        roster: z.object({
          date: dateSchema,
          "0": z.object({ players: indexed(z.object({ player: rosterPlayerSchema })) }),
        }),
      }),
    ]),
  }),
});

type RosterPlayer = z.infer<typeof rosterPlayerSchema>;

function injuryToday({
  status,
  injury_note,
}: RosterPlayer): TeamDay["players"][number]["player"]["injuryToday"] {
  return status === undefined ? null : { designation: status, reason: injury_note ?? null };
}

function toTeamDayPlayer(player: RosterPlayer): TeamDay["players"][number] {
  const slot = player.selected_position.position;
  return {
    player: {
      playerKey: player.player_key,
      name: player.name.full,
      nbaTeam: player.editorial_team_abbr,
      positions: player.display_position.split(","),
      // A dated roster carries today's injury, whatever the date asked for.
      injuryToday: injuryToday(player),
    },
    slot,
    isStartingSlot: !NON_STARTING_SLOTS.has(slot),
    line: player.player_stats.stats,
  };
}

/**
 * D2: Yahoo's dated roster with each player's stats that date, as a team day.
 * The roster must be the team and date asked for, and every player's slot must
 * be for that date, so a stale or shifted answer fails instead of misleading.
 */
export function parseTeamDay(body: unknown, teamKey: string, date: string): TeamDay {
  const [team, { roster }] = parseYahoo(teamDaySchema, body).fantasy_content.team;
  const players = roster["0"].players.map(({ player }) => player);
  const wrongDate = players.some((player) => player.selected_position.date !== date);
  if (team.team_key !== teamKey || roster.date !== date || wrongDate) {
    throw new YahooResponseError(["team day: not the team or date asked for"]);
  }
  return { teamKey, date, players: players.map(toTeamDayPlayer) };
}
