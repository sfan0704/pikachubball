import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password"),  // Nullable for OAuth users
  yahooGuid: text("yahoo_guid").unique(),  // Yahoo's unique user identifier
  displayName: text("display_name"),  // Display name from Yahoo profile
  email: text("email"),  // Email from Yahoo profile (optional)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const yahooTokens = pgTable("yahoo_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const openaiCredentials = pgTable("openai_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas

// Schema for local auth users (admin) - requires password
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Schema for OAuth users - requires yahooGuid, no password
export const insertOAuthUserSchema = createInsertSchema(users).pick({
  username: true,
  yahooGuid: true,
  displayName: true,
  email: true,
}).extend({
  yahooGuid: z.string().min(1, "Yahoo GUID is required"),
});

export const insertYahooTokenSchema = createInsertSchema(yahooTokens).omit({
  id: true,
});

export const insertOpenaiCredentialsSchema = createInsertSchema(openaiCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOAuthUser = z.infer<typeof insertOAuthUserSchema>;
export type User = typeof users.$inferSelect;
export type YahooToken = typeof yahooTokens.$inferSelect;
export type InsertYahooToken = z.infer<typeof insertYahooTokenSchema>;
export type OpenaiCredentials = typeof openaiCredentials.$inferSelect;
export type InsertOpenaiCredentials = z.infer<typeof insertOpenaiCredentialsSchema>;

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

export const playerGameSchema = z.object({
  playerKey: z.string(),
  playerName: z.string(),
  team: z.string(),
  opponent: z.string().optional(),
});

export const dayScheduleSchema = z.object({
  date: z.string(),
  dayOfWeek: z.string(),
  games: z.array(playerGameSchema),
  gameCount: z.number(),
});

export const scheduleMatrixResponseSchema = z.object({
  myTeam: z.object({
    teamKey: z.string(),
    teamName: z.string(),
    schedule: z.array(dayScheduleSchema),
    totalGames: z.number(),
  }),
  opponent: z.object({
    teamKey: z.string(),
    teamName: z.string(),
    schedule: z.array(dayScheduleSchema),
    totalGames: z.number(),
  }).optional(),
  metadata: rankingsMetadataSchema,
  isPlaceholder: z.boolean(),
  placeholderMessage: z.string().optional(),
});

export type HeatmapCell = z.infer<typeof heatmapCellSchema>;
export type TeamHeatmapData = z.infer<typeof teamHeatmapDataSchema>;
export type LeagueHeatmapResponse = z.infer<typeof leagueHeatmapResponseSchema>;
export type CategoryComparison = z.infer<typeof categoryComparisonSchema>;
export type MatchupComparisonResponse = z.infer<typeof matchupComparisonResponseSchema>;
export type PlayerGame = z.infer<typeof playerGameSchema>;
export type DaySchedule = z.infer<typeof dayScheduleSchema>;
export type ScheduleMatrixResponse = z.infer<typeof scheduleMatrixResponseSchema>;
