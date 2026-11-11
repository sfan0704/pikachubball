import { z } from "zod";
import { indexed, parseYahoo, yahooInteger } from "../yahoo-shapes";
import type { Draft } from "../daily-stats-source";

/*
 * D8: `/league/{L}/draftresults`. Every pick of an auction carries its price;
 * a snake draft's picks have none, so the prices say which kind of draft it was
 * without a settings call. Before the draft, picks have no team or player yet.
 */

type Pick = Draft["picks"][number];

const resultSchema = z.object({
  draft_result: z.object({
    pick: yahooInteger,
    round: yahooInteger,
    cost: yahooInteger.optional(),
    team_key: z.string().min(1).optional(),
    player_key: z.string().min(1).optional(),
  }),
});

type Result = z.infer<typeof resultSchema>["draft_result"];

const responseSchema = z.object({
  fantasy_content: z.object({
    league: z.tuple([
      z.unknown(),
      z.object({
        draft_results: z.union([
          z.tuple([]).transform((): z.infer<typeof resultSchema>[] => []),
          indexed(resultSchema),
        ]),
      }),
    ]),
  }),
});

function toPick(result: Result & { team_key: string; player_key: string }): Pick {
  return {
    pick: result.pick,
    round: result.round,
    teamKey: result.team_key,
    playerKey: result.player_key,
    cost: result.cost ?? null,
  };
}

function isMade(result: Result): result is Result & { team_key: string; player_key: string } {
  return result.team_key !== undefined && result.player_key !== undefined;
}

/** The league's picks so far, in pick order, and whether it was an auction. */
export function parseDraft(response: unknown): Draft {
  const [, { draft_results }] = parseYahoo(responseSchema, response).fantasy_content.league;
  const results = draft_results.map(({ draft_result }) => draft_result);
  const picks = results
    .filter(isMade)
    .map(toPick)
    .sort((a, b) => a.pick - b.pick);
  return { isAuction: results.some((result) => result.cost !== undefined), picks };
}
