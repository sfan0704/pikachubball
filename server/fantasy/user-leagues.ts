import { z } from "zod";
import {
  fragments,
  indexed,
  parseYahoo,
  YahooResponseError,
  yahooFlag,
  yahooInteger,
} from "./yahoo-shapes";

/** Where a league is in its season. */
export type LeagueStatus = "preseason" | "active" | "finished";

/** One of the user's leagues, with the user's team in it. */
export interface DiscoveredLeague {
  leagueKey: string;
  teamKey: string;
  name: string;
  season: number;
  status: LeagueStatus;
}

// Yahoo writes an empty collection as an empty list rather than `{"count": 0}`.
const collection = <T extends z.ZodTypeAny>(item: T) =>
  z.union([z.array(z.never()).length(0), indexed(item)]);

const gameSchema = z.object({
  season: yahooInteger,
  is_game_over: yahooFlag,
  is_offseason: yahooFlag,
});

const teamSchema = z.object({
  team: fragments(z.object({ team_key: z.string().regex(/^\d+\.l\.\d+\.t\.\d+$/) })),
});

const leagueSchema = z.object({
  league: fragments(
    z.object({
      league_key: z.string().regex(/^\d+\.l\.\d+$/),
      name: z.string().min(1),
      draft_status: z.string(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      current_week: yahooInteger,
      end_week: yahooInteger,
      // Yahoo sends the flag only for a finished league.
      is_finished: yahooFlag.optional(),
    })
  ),
});

/** `/users;use_login=1/games;game_codes=nba/...` for the signed-in user, with the given game. */
const userGamesSchema = <G extends z.ZodTypeAny>(game: G) =>
  z.object({
    fantasy_content: z.object({
      users: indexed(
        z.object({ user: fragments(z.object({ games: collection(z.object({ game })) })) })
      ).transform((users, context) => {
        const [only] = users;
        if (!only || users.length !== 1) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "expected one user" });
          return z.NEVER;
        }
        return only.user;
      }),
    }),
  });

const teamsSchema = userGamesSchema(
  fragments(gameSchema.extend({ teams: collection(teamSchema) }))
);
const leaguesSchema = userGamesSchema(
  fragments(gameSchema.extend({ leagues: collection(leagueSchema) }))
);

type Game = z.infer<typeof gameSchema>;
type League = z.infer<typeof leagueSchema>["league"];

/**
 * Finished: Yahoo marks the league or its game over, or the current week is
 * past the end week. Preseason: not drafted yet, not started, or the game is
 * between seasons. Yahoo's own `current_date` stays at the start date until
 * the season begins, so it can't tell whether a league has started.
 */
function statusOf(game: Game, league: League, today: string): LeagueStatus {
  if (league.is_finished || game.is_game_over || league.current_week > league.end_week) {
    return "finished";
  }
  if (league.draft_status === "predraft" || league.start_date > today || game.is_offseason) {
    return "preseason";
  }
  return "active";
}

function leaguesByKey(response: unknown): Map<string, { game: Game; league: League }> {
  const user = parseYahoo(leaguesSchema, response).fantasy_content.users;
  const byKey = new Map<string, { game: Game; league: League }>();
  for (const { game } of user.games) {
    for (const { league } of game.leagues) {
      byKey.set(league.league_key, { game, league });
    }
  }
  return byKey;
}

/**
 * Joins the user's teams with their leagues. The teams call has no league
 * names or draft state, and the leagues call has no team, so both are needed.
 * `today` is the date in the NBA's timezone, as YYYY-MM-DD.
 */
export function parseUserLeagues(
  teamsResponse: unknown,
  leaguesResponse: unknown,
  today: string
): DiscoveredLeague[] {
  const user = parseYahoo(teamsSchema, teamsResponse).fantasy_content.users;
  const leagues = leaguesByKey(leaguesResponse);
  return user.games.flatMap(({ game }) =>
    game.teams.map(({ team }): DiscoveredLeague => {
      const leagueKey = team.team_key.replace(/\.t\.\d+$/, "");
      const found = leagues.get(leagueKey);
      if (!found) {
        throw new YahooResponseError([`teams: league ${leagueKey} is not in the user's leagues`]);
      }
      return {
        leagueKey,
        teamKey: team.team_key,
        name: found.league.name,
        season: found.game.season,
        status: statusOf(found.game, found.league, today),
      };
    })
  );
}
