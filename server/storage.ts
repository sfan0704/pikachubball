import { type User, type InsertUser, type YahooToken, type InsertYahooToken } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  saveYahooToken(token: InsertYahooToken): Promise<YahooToken>;
  getYahooToken(userId: string): Promise<YahooToken | undefined>;
  deleteYahooToken(userId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private yahooTokens: Map<string, YahooToken>;

  constructor() {
    this.users = new Map();
    this.yahooTokens = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async saveYahooToken(insertToken: InsertYahooToken): Promise<YahooToken> {
    const existing = Array.from(this.yahooTokens.values()).find(
      (token) => token.userId === insertToken.userId
    );
    
    if (existing) {
      const updated: YahooToken = { ...existing, ...insertToken };
      this.yahooTokens.set(existing.id, updated);
      return updated;
    }
    
    const id = randomUUID();
    const token: YahooToken = { id, ...insertToken };
    this.yahooTokens.set(id, token);
    return token;
  }

  async getYahooToken(userId: string): Promise<YahooToken | undefined> {
    return Array.from(this.yahooTokens.values()).find(
      (token) => token.userId === userId
    );
  }

  async deleteYahooToken(userId: string): Promise<void> {
    const token = Array.from(this.yahooTokens.values()).find(
      (token) => token.userId === userId
    );
    if (token) {
      this.yahooTokens.delete(token.id);
    }
  }
}

export const storage = new MemStorage();
