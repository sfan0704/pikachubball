import { z } from "zod";

// Yahoo API Response Types (DTOs)
// These are enhanced versions of domain models for API responses

export const leagueSchema = z.object({
  leagueKey: z.string(),
  leagueName: z.string(),
  teamKey: z.string(),
  teamName: z.string(),
  season: z.number().optional(),
  gameKey: z.string().optional(),
});

export const playerSchema = z.object({
  playerKey: z.string(),
  name: z.string(),
  position: z.string(),
  team: z.string(), // DTO uses 'team' for frontend compatibility (domain uses 'nbaTeam')
  status: z.enum(["active", "injured", "out"]),
});

export const categoryStatsSchema = z.object({
  fgPct: z.number(),
  ftPct: z.number(),
  tpm: z.number(),
  pts: z.number(),
  reb: z.number(),
  ast: z.number(),
  stl: z.number(),
  blk: z.number(),
  to: z.number(),
});

export const teamRankingSchema = z.object({
  teamKey: z.string(),
  teamName: z.string(),
  managerName: z.string().optional(),
  stats: categoryStatsSchema,
  categoryRanks: categoryStatsSchema, // Note: This represents ranks, not stats, but uses same structure
  totalRank: z.number(),
});

export const rankingsMetadataSchema = z.object({
  scope: z.enum(['season', 'week']),
  week: z.number().optional(),
  currentWeek: z.number(),
  totalWeeks: z.number(),
});

export const rankingsResponseSchema = z.object({
  rankings: z.array(teamRankingSchema),
  metadata: rankingsMetadataSchema,
});

export type League = z.infer<typeof leagueSchema>;
export type Player = z.infer<typeof playerSchema>;
export type CategoryStats = z.infer<typeof categoryStatsSchema>;
export type TeamRanking = z.infer<typeof teamRankingSchema>;
export type RankingsMetadata = z.infer<typeof rankingsMetadataSchema>;
export type RankingsResponse = z.infer<typeof rankingsResponseSchema>;

// Visualization Response Types
export const heatmapCellSchema = z.object({
  value: z.number(),
  rank: z.number(),
  percentile: z.number(),
});

export const teamHeatmapDataSchema = z.object({
  teamKey: z.string(),
  teamName: z.string(),
  categories: z.object({
    fgPct: heatmapCellSchema,
    ftPct: heatmapCellSchema,
    tpm: heatmapCellSchema,
    pts: heatmapCellSchema,
    reb: heatmapCellSchema,
    ast: heatmapCellSchema,
    stl: heatmapCellSchema,
    blk: heatmapCellSchema,
    to: heatmapCellSchema,
  }),
});

export const leagueHeatmapResponseSchema = z.object({
  teams: z.array(teamHeatmapDataSchema),
  metadata: rankingsMetadataSchema,
});

export const categoryComparisonSchema = z.object({
  category: z.string(),
  myTeam: z.number(),
  opponent: z.number(),
  difference: z.number(),
  winning: z.boolean(),
  myTeamMakes: z.number().optional(),
  myTeamAttempts: z.number().optional(),
  opponentMakes: z.number().optional(),
  opponentAttempts: z.number().optional(),
});

export const matchupComparisonResponseSchema = z.object({
  myTeam: z.object({
    teamKey: z.string(),
    teamName: z.string(),
  }),
  opponent: z.object({
    teamKey: z.string(),
    teamName: z.string(),
  }),
  categories: z.array(categoryComparisonSchema),
  score: z.object({
    wins: z.number(),
    losses: z.number(),
    ties: z.number(),
  }),
  metadata: rankingsMetadataSchema,
});

export type HeatmapCell = z.infer<typeof heatmapCellSchema>;
export type TeamHeatmapData = z.infer<typeof teamHeatmapDataSchema>;
export type LeagueHeatmapResponse = z.infer<typeof leagueHeatmapResponseSchema>;
export type CategoryComparison = z.infer<typeof categoryComparisonSchema>;
export type MatchupComparisonResponse = z.infer<typeof matchupComparisonResponseSchema>;
