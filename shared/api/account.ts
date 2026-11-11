import { z } from "zod";

/** What the user has chosen to keep: the selected league and team, and display options. */
export const preferencesSchema = z
  .object({
    selectedLeagueKey: z.string().min(3).max(128).nullable(),
    selectedTeamKey: z.string().min(3).max(128).nullable(),
    display: z
      .record(z.string(), z.unknown())
      .refine((value) => JSON.stringify(value).length <= 4096, "display options are too large"),
  })
  .strict();

export type Preferences = z.infer<typeof preferencesSchema>;

/**
 * What the server has wired. Each switch shows or hides its screens; all are
 * off in production until the Yahoo daily-stats source is wired.
 */
export const featuresSchema = z.object({
  /** The Matchup and League daily-stats screens. */
  matchupAndLeague: z.boolean(),
  /** The Players screen. */
  players: z.boolean(),
  /** "Next 7 projected"; off until a projection source exists. */
  projections: z.boolean(),
});

export type Features = z.infer<typeof featuresSchema>;

/** The body of `GET /api/me`. */
export const meResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    displayName: z.string().nullable(),
    email: z.string().nullable(),
  }),
  /** Whether Yahoo tokens are stored. A grant Yahoo later rejects shows up as YAHOO_RECONNECT_REQUIRED on data calls. */
  yahoo: z.object({ connected: z.boolean() }),
  preferences: preferencesSchema,
  features: featuresSchema,
});

export type MeResponse = z.infer<typeof meResponseSchema>;
