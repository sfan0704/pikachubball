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

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type YahooCredentials = typeof yahooCredentials.$inferSelect;
export type InsertYahooCredentials = z.infer<typeof insertYahooCredentialsSchema>;
export type YahooToken = typeof yahooTokens.$inferSelect;
export type InsertYahooToken = z.infer<typeof insertYahooTokenSchema>;

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
  stats: categoryStatsSchema,
  categoryRanks: categoryStatsSchema,
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
