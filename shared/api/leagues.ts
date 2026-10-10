import { z } from "zod";

/** One of the user's stored leagues and their team in it. */
export const userLeagueSchema = z.object({
  leagueKey: z.string(),
  teamKey: z.string(),
  name: z.string(),
  season: z.number().int().nullable(),
  isFinished: z.boolean(),
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

const TEAM_KEY = /^\d+\.l\.\d+\.t\.\d+$/;

/** The path of `GET /api/leagues/:key/teams/:team/roster`; the team must belong to the league. */
export const rosterParamsSchema = z
  .object({
    key: z.string().regex(/^\d+\.l\.\d+$/, "must be a Yahoo league key"),
    team: z.string().regex(TEAM_KEY, "must be a Yahoo team key"),
  })
  .refine(({ key, team }) => team.startsWith(`${key}.t.`), {
    message: "team is not in this league",
    path: ["team"],
  });

/** The body of the roster endpoint. */
export const rosterResponseSchema = z.object({
  /** When the roster was read from Yahoo (ISO 8601, UTC); it applies to that moment. */
  fetchedAt: z.string().datetime(),
  roster: z.array(
    z.object({
      playerKey: z.string(),
      name: z.string(),
      position: z.string(),
      team: z.string(),
      status: z.enum(["active", "injured", "out"]),
    })
  ),
});

export type RosterResponse = z.infer<typeof rosterResponseSchema>;
