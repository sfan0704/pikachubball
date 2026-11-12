import { z } from "zod";

/** Where a league is in its season: not drafted or not started, in progress, or over. */
export const leagueStatusSchema = z.enum(["preseason", "active", "finished"]);

export type LeagueStatus = z.infer<typeof leagueStatusSchema>;

/** One of the user's stored leagues and their team in it. */
export const userLeagueSchema = z.object({
  leagueKey: z.string(),
  teamKey: z.string(),
  name: z.string(),
  season: z.number().int().nullable(),
  status: leagueStatusSchema,
  syncedAt: z.string().datetime({ offset: true }),
});

export type UserLeague = z.infer<typeof userLeagueSchema>;

/** A league as it is saved, before the database stamps the sync time. */
export type UserLeagueInput = Omit<UserLeague, "syncedAt">;

/** The query of `GET /api/leagues`. */
export const leaguesQuerySchema = z.object({
  refresh: z.enum(["true", "false"]).optional(),
});

/** The body of `GET /api/leagues`. */
export const leaguesResponseSchema = z.object({ leagues: z.array(userLeagueSchema) });

export type LeaguesResponse = z.infer<typeof leaguesResponseSchema>;
