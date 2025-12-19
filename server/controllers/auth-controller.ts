import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { hashPassword, passport } from "../config/auth";
import { insertUserSchema } from "@shared/schema";
import { asyncHandler, ConflictError, UnauthorizedError } from "../middleware/error-handler";

/**
 * Authentication controller
 * Handles all authentication-related business logic
 */
export const authController = {
  /**
   * Sign up a new user
   */
  signup: asyncHandler(async (req: Request, res: Response) => {
    const validatedData = insertUserSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await storage.getUserByUsername(validatedData.username);
    if (existingUser) {
      throw new ConflictError("Username already exists");
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
        throw new Error("Failed to log in after signup");
      }

      // Don't send password hash to client
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ user: userWithoutPassword });
    });
  }),

  /**
   * Log in an existing user
   */
  login: (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: Error | null, user: any, info?: { message: string }) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.status(401).json({
          error: info?.message || "Authentication failed",
          code: "UNAUTHORIZED",
        });
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }

        // Don't send password hash to client
        const { password, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    })(req, res, next);
  },

  /**
   * Log out the current user
   */
  logout: (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({
          error: "Failed to log out",
          code: "INTERNAL_ERROR",
        });
      }
      res.json({ success: true });
    });
  },

  /**
   * Get the current authenticated user
   */
  getCurrentUser: asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      throw new UnauthorizedError("Not authenticated");
    }

    // Don't send password hash to client
    const user = req.user as { id: string; username: string; password?: string };
    const { password, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  }),
};

