import { z } from "zod";
import { CATEGORIES } from "../domain/stats";
import type { TeamTable } from "../domain/team-table";

const nullableNumber = z.number().nullable();

const leagueCategorySchema = z.object({
  statId: z.string(),
  key: z.enum(CATEGORIES).nullable(),
  displayName: z.string(),
  direction: z.enum(["higher", "lower"]),
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

const teamTotalsSchema = z.object({
  fgMakes: nullableNumber,
  fgAttempts: nullableNumber,
  ftMakes: nullableNumber,
  ftAttempts: nullableNumber,
  tpm: nullableNumber,
  pts: nullableNumber,
  reb: nullableNumber,
  ast: nullableNumber,
  stl: nullableNumber,
  blk: nullableNumber,
  to: nullableNumber,
});

const teamRowSchema = z.object({
  teamKey: z.string(),
  teamName: z.string(),
  managerName: z.string().nullable(),
  totals: teamTotalsSchema,
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
