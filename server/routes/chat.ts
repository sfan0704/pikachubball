import type { Express } from "express";
import { requireAuth } from "../middleware/auth";
import { requireYahooAuth } from "../middleware/yahoo-auth";
import { chatController } from "../controllers/chat-controller";

/** Register AI chat endpoint with OpenAI integration */
export function registerChatRoutes(app: Express): void {
  app.post(
    "/api/chat/message",
    requireAuth,
    requireYahooAuth,
    chatController.sendMessage
  );
}
