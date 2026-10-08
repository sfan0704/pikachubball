import { z } from "zod";

/** Which table to return: the whole season, the league's current week, or a specific week. */
export const leagueScopeSchema = z.union([
  z.literal("season"),
  z.literal("current"),
  z
    .string()
    .regex(/^[1-9]\d{0,2}$/, "must be season, current or a week number")
    .transform(Number),
]);

export type LeagueScope = z.infer<typeof leagueScopeSchema>;

/** The path of `GET /api/leagues/:key/:scope`. */
export const leagueScopeParamsSchema = z.object({
  key: z.string().regex(/^\d+\.l\.\d+$/, "must be a Yahoo league key"),
  scope: leagueScopeSchema,
});

export type LeagueScopeParams = z.infer<typeof leagueScopeParamsSchema>;
