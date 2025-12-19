import type { Request, Response } from "express";
import { storage } from "../storage";
import { getAuthenticatedUserId } from "../middleware/auth";
import { decrypt } from "../utils/encryption";
import OpenAI from "openai";
import { asyncHandler, ValidationError, NotFoundError } from "../middleware/error-handler";
import { sendChatMessage } from "../services/chat/chat-service";

/**
 * Chat controller
 * Thin HTTP adapter for AI chat with OpenAI integration
 */
export const chatController = {
  /**
   * Send a chat message to the AI assistant
   */
  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);

    const { message, conversationHistory } = req.body;

    if (!message || typeof message !== "string") {
      throw new ValidationError("Message is required");
    }

    // Check for OpenAI credentials
    const openaiCreds = await storage.getOpenaiCredentials(userId);
    if (!openaiCreds) {
      throw new NotFoundError(
        "OpenAI API key. Please add your OpenAI API key in Settings to use the AI assistant."
      );
    }

    const userApiKey = decrypt(openaiCreds.encryptedApiKey);
    const openai = new OpenAI({ apiKey: userApiKey });

    // Call service for business logic
    const response = await sendChatMessage(openai, message, conversationHistory);

    res.json({
      message: response.message,
      toolCalls: response.toolCalls || [],
      finishReason: response.finishReason,
    });
  }),
};

