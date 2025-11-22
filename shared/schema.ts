import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const yahooCredentials = pgTable("yahoo_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  encryptedClientId: text("encrypted_client_id").notNull(),
  encryptedClientSecret: text("encrypted_client_secret").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertYahooCredentialsSchema = createInsertSchema(yahooCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
export type User = typeof users.$inferSelect;
export type YahooCredentials = typeof yahooCredentials.$inferSelect;
export type InsertYahooCredentials = z.infer<typeof insertYahooCredentialsSchema>;
export type YahooToken = typeof yahooTokens.$inferSelect;
export type InsertYahooToken = z.infer<typeof insertYahooTokenSchema>;
export type OpenaiCredentials = typeof openaiCredentials.$inferSelect;
export type InsertOpenaiCredentials = z.infer<typeof insertOpenaiCredentialsSchema>;

// Yahoo API Response Types
export const leagueSchema = z.object({
  leagueKey: z.string(),
  leagueName: z.string(),
  teamKey: z.string(),
  teamName: z.string(),
});

export const playerSchema = z.object({
  name: z.string(),
  position: z.string(),
  team: z.string(),
  status: z.enum(["active", "injured", "out"]),
  playerKey: z.string().optional(),
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
  categoryRanks: categoryStatsSchema,
  totalRank: z.number(),
  // gamesPlayed: z.number().optional(),
  // gamesRemaining: z.number().optional(),
});

export const rankingsMetadataSchema = z.object({
  scope: z.enum(['season', 'week']),
  week: z.number().optional(),
  currentWeek: z.number(),
  totalWeeks: z.number(),
  // gamesPlayed: z.number().optional(),
  // gamesRemaining: z.number().optional(),
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
