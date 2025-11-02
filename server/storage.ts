import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, yahooTokens, yahooCredentials } from "@shared/schema";
import type {
  User,
  InsertUser,
  YahooToken,
  InsertYahooToken,
  YahooCredentials,
  InsertYahooCredentials,
} from "@shared/schema";

export interface IStorage {
  // User operations
  createUser(user: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;

  // Yahoo token operations
  saveYahooToken(token: InsertYahooToken): Promise<YahooToken>;
  getYahooToken(userId: string): Promise<YahooToken | undefined>;
  deleteYahooToken(userId: string): Promise<void>;

  // Yahoo credentials operations
  saveYahooCredentials(credentials: InsertYahooCredentials): Promise<YahooCredentials>;
  getYahooCredentials(userId: string): Promise<YahooCredentials | undefined>;
  deleteYahooCredentials(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  // Yahoo token operations
  async saveYahooToken(insertToken: InsertYahooToken): Promise<YahooToken> {
    const [existing] = await db
      .select()
      .from(yahooTokens)
      .where(eq(yahooTokens.userId, insertToken.userId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(yahooTokens)
        .set(insertToken)
        .where(eq(yahooTokens.userId, insertToken.userId))
        .returning();
      return updated;
    }

    const [token] = await db.insert(yahooTokens).values(insertToken).returning();
    return token;
  }

  async getYahooToken(userId: string): Promise<YahooToken | undefined> {
    const [token] = await db
      .select()
      .from(yahooTokens)
      .where(eq(yahooTokens.userId, userId))
      .limit(1);
    return token;
  }

  async deleteYahooToken(userId: string): Promise<void> {
    await db.delete(yahooTokens).where(eq(yahooTokens.userId, userId));
  }

  // Yahoo credentials operations
  async saveYahooCredentials(insertCredentials: InsertYahooCredentials): Promise<YahooCredentials> {
    const [existing] = await db
      .select()
      .from(yahooCredentials)
      .where(eq(yahooCredentials.userId, insertCredentials.userId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(yahooCredentials)
        .set({
          ...insertCredentials,
          updatedAt: new Date(),
        })
        .where(eq(yahooCredentials.userId, insertCredentials.userId))
        .returning();
      return updated;
    }

    const [credentials] = await db
      .insert(yahooCredentials)
      .values(insertCredentials)
      .returning();
    return credentials;
  }

  async getYahooCredentials(userId: string): Promise<YahooCredentials | undefined> {
    const [credentials] = await db
      .select()
      .from(yahooCredentials)
      .where(eq(yahooCredentials.userId, userId))
      .limit(1);
    return credentials;
  }

  async deleteYahooCredentials(userId: string): Promise<void> {
    await db.delete(yahooCredentials).where(eq(yahooCredentials.userId, userId));
  }
}

export const storage = new DatabaseStorage();
