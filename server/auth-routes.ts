import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { hashPassword } from "./auth";
import { passport } from "./auth";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";

// Authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Get authenticated user ID helper
export function getAuthenticatedUserId(req: Request): string | null {
  if (!req.isAuthenticated() || !req.user) {
    return null;
  }
  return (req.user as any).id;
}

export function registerAuthRoutes(app: Express) {
  // Signup
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(validatedData.password);
      const user = await storage.createUser({
        username: validatedData.username,
        password: hashedPassword,
      });

      // Log the user in automatically after signup
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to log in after signup" });
        }
        
        // Don't send password hash to client
        const { password, ...userWithoutPassword } = user;
        return res.status(201).json({ user: userWithoutPassword });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Signup error:", error);
      return res.status(500).json({ error: "Failed to create account" });
    }
  });

  // Login
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ error: info?.message || "Authentication failed" });
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        
        // Don't send password hash to client
        const { password, ...userWithoutPassword } = user;
        return res.json({ user: userWithoutPassword });
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to log out" });
      }
      res.json({ success: true });
    });
  });

  // Get current user
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Don't send password hash to client
    const { password, ...userWithoutPassword } = req.user as any;
    res.json({ user: userWithoutPassword });
  });
}
