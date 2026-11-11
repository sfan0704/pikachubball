import { z } from "zod";
import { dateSchema } from "../../../shared/api/daily-stats-values";
import type { Weeks } from "../daily-stats-source";
import { indexed, parseYahoo, YahooResponseError, yahooInteger } from "../yahoo-shapes";

const gameWeeksSchema = z.object({
  fantasy_content: z.object({
    game: z.tuple([
      z.object({ game_key: z.coerce.string() }),
      z.object({
        game_weeks: indexed(
          z.object({
            game_week: z.object({
              week: yahooInteger.positive(),
              start: dateSchema,
              end: dateSchema,
            }),
          })
        ),
      }),
    ]),
  }),
});

/**
 * D10: the season's scoring weeks from `/game/{G}/game_weeks`, in week order.
 * Weeks must belong to the game asked for and not end before they start.
 */
export function parseWeeks(body: unknown, gameKey: string): Weeks {
  const [game, { game_weeks }] = parseYahoo(gameWeeksSchema, body).fantasy_content.game;
  const weeks = game_weeks.map(({ game_week: { week, start, end } }) => ({ week, start, end }));
  if (game.game_key !== gameKey || weeks.some(({ start, end }) => start > end)) {
    throw new YahooResponseError([
      "game weeks: not the season asked for, or a week ends before it starts",
    ]);
  }
  return { weeks: weeks.sort((a, b) => a.week - b.week) };
}
