import { z } from "zod";
import { addDays } from "../../../shared/domain";
import type { Schedule } from "../daily-stats-source";
import { fragments, parseYahoo } from "../yahoo-shapes";
import type { DailyStatsRequests } from "./daily-stats-requests";
import { PLAYER_KEYS_PER_CALL } from "./daily-stats-requests";
import { parseGameLogPlayers, type GameLogPlayer } from "./game-log-parser";

/** Every NBA team; the schedule is complete once each has a rostered player on a page. */
export const NBA_TEAM_COUNT = 30;

/** The retrieval plan's ceiling for D6: 9 pages cover every rostered player in a 14-team league. */
export const MAX_SCHEDULE_PAGES = 9;

/** The league's own fantasy date (US Eastern), which every status=T page carries. */
const leagueDateSchema = z.object({
  fantasy_content: z.object({
    league: z
      .tuple([fragments(z.object({ current_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))])
      .rest(z.unknown()),
  }),
});

function schedulePage(leagueKey: string, start: number): string {
  return `/league/${leagueKey}/players;status=T;start=${start};count=${PLAYER_KEYS_PER_CALL};out=game_log`;
}

/**
 * D6: every NBA team's games, read from the game logs of rostered players
 * (`status=T`), page by page until each of the 30 teams has one. A team no
 * one in the league rosters after the last page is left out, which the client
 * treats as unknown rather than as no games. Games before yesterday (US
 * Eastern) are dropped: tonight in any US time zone is at most a day behind.
 */
export async function readSchedule(
  requests: DailyStatsRequests,
  leagueKey: string
): Promise<Schedule> {
  const firstPage = await requests.get("schedule", schedulePage(leagueKey, 0));
  const leagueDate = parseYahoo(leagueDateSchema, firstPage).fantasy_content.league[0].current_date;
  const byTeam = new Map<string, GameLogPlayer>();
  let body = firstPage;
  for (let page = 1; ; page += 1) {
    const players = parseGameLogPlayers(body);
    for (const player of players) {
      if (!byTeam.has(player.nbaTeam)) {
        byTeam.set(player.nbaTeam, player);
      }
    }
    const done = byTeam.size >= NBA_TEAM_COUNT || players.length < PLAYER_KEYS_PER_CALL;
    if (done || page === MAX_SCHEDULE_PAGES) {
      break;
    }
    body = await requests.get("schedule", schedulePage(leagueKey, page * PLAYER_KEYS_PER_CALL));
  }
  return { teams: teamGames([...byTeam.values()], addDays(leagueDate, -1)) };
}

/** Each team's games from `from` on, oldest first and without the player's minutes; teams in name order. */
function teamGames(players: readonly GameLogPlayer[], from: string): Schedule["teams"] {
  return players
    .map(({ nbaTeam, games }) => ({
      nbaTeam,
      games: games
        .filter((game) => game.date >= from)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(({ minutes: _minutes, ...game }) => game),
    }))
    .sort((a, b) => a.nbaTeam.localeCompare(b.nbaTeam));
}
