import { eq } from "drizzle-orm";
import { db } from "./config/db";
import { users, yahooTokens, openaiCredentials } from "@shared/schema";
import type {
  User,
  InsertUser,
  InsertOAuthUser,
  YahooToken,
  InsertYahooToken,
  OpenaiCredentials,
  InsertOpenaiCredentials,
} from "@shared/schema";

export interface IStorage {
  // User operations
  createUser(user: InsertUser): Promise<User>;
  createOAuthUser(user: InsertOAuthUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByYahooGuid(yahooGuid: string): Promise<User | undefined>;

  // Yahoo token operations
  saveYahooToken(token: InsertYahooToken): Promise<YahooToken>;
  getYahooToken(userId: string): Promise<YahooToken | undefined>;
  deleteYahooToken(userId: string): Promise<void>;

  // OpenAI credentials operations
  saveOpenaiCredentials(credentials: InsertOpenaiCredentials): Promise<OpenaiCredentials>;
  getOpenaiCredentials(userId: string): Promise<OpenaiCredentials | undefined>;
  deleteOpenaiCredentials(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createOAuthUser(insertUser: InsertOAuthUser): Promise<User> {
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

  async getUserByYahooGuid(yahooGuid: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.yahooGuid, yahooGuid))
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

  // OpenAI credentials operations
  async saveOpenaiCredentials(insertCredentials: InsertOpenaiCredentials): Promise<OpenaiCredentials> {
    const [existing] = await db
      .select()
      .from(openaiCredentials)
      .where(eq(openaiCredentials.userId, insertCredentials.userId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(openaiCredentials)
        .set({
          ...insertCredentials,
          updatedAt: new Date(),
        })
        .where(eq(openaiCredentials.userId, insertCredentials.userId))
        .returning();
      return updated;
    }

    const [credentials] = await db
      .insert(openaiCredentials)
      .values(insertCredentials)
      .returning();
    return credentials;
  }

  async getOpenaiCredentials(userId: string): Promise<OpenaiCredentials | undefined> {
    const [credentials] = await db
      .select()
      .from(openaiCredentials)
      .where(eq(openaiCredentials.userId, userId))
      .limit(1);
    return credentials;
  }

  async deleteOpenaiCredentials(userId: string): Promise<void> {
    await db.delete(openaiCredentials).where(eq(openaiCredentials.userId, userId));
  }
}

export const storage = new DatabaseStorage();
