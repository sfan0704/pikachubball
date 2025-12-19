import type OpenAI from "openai";
import { getOpenAITools } from "./openai-tools";

/**
 * Chat Service
 * Business logic for AI chat operations
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  message: string;
  toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
  finishReason: string | null;
}

/**
 * Send a chat message to OpenAI with MCP tools
 */
export async function sendChatMessage(
  openai: OpenAI,
  message: string,
  conversationHistory?: ChatMessage[]
): Promise<ChatResponse> {
  const tools = getOpenAITools();

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    ...(conversationHistory || []),
    { role: "user", content: message },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.7,
  });

  const assistantMessage = response.choices[0].message;
  return {
    message: assistantMessage.content || "",
    toolCalls: assistantMessage.tool_calls || [],
    finishReason: response.choices[0].finish_reason,
  };
}

