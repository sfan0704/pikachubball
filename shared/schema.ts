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
