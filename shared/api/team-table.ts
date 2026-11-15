import { z } from "zod";
import type { TeamTable } from "../domain/team-table";

const nullableNumber = z.number().nullable();

const leagueCategorySchema = z.object({
  statId: z.string(),
  displayName: z.string(),
  direction: z.enum(["higher", "lower"]),
  makeup: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("counting") }),
    z.object({ kind: z.literal("ratio"), topStatId: z.string(), bottomStatId: z.string() }),
    z.object({ kind: z.literal("unavailable") }),
  ]),
});

const leagueSettingsSchema = z.object({
  leagueKey: z.string(),
  name: z.string(),
  season: z.number().int(),
  scoringType: z.string(),
  categories: z.array(leagueCategorySchema),
  startWeek: z.number().int(),
  endWeek: z.number().int(),
  currentWeek: z.number().int(),
  isFinished: z.boolean(),
});

const teamRowSchema = z.object({
  teamKey: z.string(),
  teamName: z.string(),
  managerName: z.string().nullable(),
  categoryValues: z.record(z.string(), nullableNumber),
  games: z
    .object({
      remaining: z.number().int().nonnegative(),
      live: z.number().int().nonnegative(),
      completed: z.number().int().nonnegative(),
    })
    .nullable(),
  record: z
    .object({
      wins: z.number().int().nonnegative(),
      losses: z.number().int().nonnegative(),
      ties: z.number().int().nonnegative(),
    })
    .nullable(),
});

const matchupPairingSchema = z.object({
  teamKeys: z.tuple([z.string(), z.string()]),
  winnerTeamKey: z.string().nullable(),
  isTied: z.boolean(),
});

const scopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("season") }),
  z.object({ kind: z.literal("week"), week: z.number().int().positive() }),
]);

/** The body of the league-scope response: every team's totals for one league and scope. */
export const teamTableSchema = z.object({
  scope: scopeSchema,
  settings: leagueSettingsSchema,
  teams: z.array(teamRowSchema),
  pairings: z.array(matchupPairingSchema),
  fetchedAt: z.string().datetime(),
}) satisfies z.ZodType<TeamTable>;
