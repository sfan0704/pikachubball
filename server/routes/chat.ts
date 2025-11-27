import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { getValidAccessToken } from "../yahoo-auth";
import { requireAuth, getAuthenticatedUserId } from "../auth-routes";
import { decrypt } from "../encryption";
import { getMCPClient } from "../mcp-client";
import OpenAI from "openai";

/** Register AI chat endpoint with Anthropic + MCP integration */
export function registerChatRoutes(app: Express): void {
  app.post("/api/chat/message", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { message, teamKey, leagueKey, conversationHistory } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const tokenData = await storage.getYahooToken(userId);
      if (!tokenData) {
        return res.status(400).json({ 
          error: "Yahoo Fantasy not connected",
          requiresYahooConnection: true,
          message: "Please connect your Yahoo Fantasy account to use the AI assistant." 
        });
      }

      let accessToken: string | null;
      try {
        accessToken = await getValidAccessToken(userId);
      } catch (error: any) {
        return res.status(400).json({ 
          error: "Yahoo Fantasy connection expired",
          requiresYahooConnection: true,
          message: "Your Yahoo Fantasy connection has expired. Please reconnect your account." 
        });
      }

      if (!accessToken) {
        return res.status(400).json({ 
          error: "Yahoo Fantasy connection invalid",
          requiresYahooConnection: true,
          message: "Could not get valid Yahoo Fantasy credentials. Please reconnect your account." 
        });
      }

      const openaiCreds = await storage.getOpenaiCredentials(userId);
      if (!openaiCreds) {
        return res.status(400).json({ 
          error: "OpenAI API key not configured",
          requiresOpenaiKey: true,
          message: "Please add your OpenAI API key in Settings to use the AI assistant." 
        });
      }

      const userApiKey = decrypt(openaiCreds.encryptedApiKey);
      const openai = new OpenAI({ apiKey: userApiKey });

      const mcpClient = await getMCPClient();
      await mcpClient.setCredentials(accessToken, tokenData.refreshToken, tokenData.expiresAt);

      // Define MCP tools as OpenAI function calling tools
      const tools: OpenAI.ChatCompletionTool[] = [
        {
          type: "function",
          function: {
            name: "get_user_leagues",
            description: "Get all fantasy basketball leagues for the authenticated user",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "get_league_standings",
            description: "Get current standings for a specific league",
            parameters: {
              type: "object",
              properties: {
                leagueKey: { type: "string", description: "The league key (e.g., '466.l.29849')" }
              },
              required: ["leagueKey"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_team_roster",
            description: "Get the roster for a specific team",
            parameters: {
              type: "object",
              properties: {
                teamKey: { type: "string", description: "The team key (e.g., '466.l.29849.t.10')" }
              },
              required: ["teamKey"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_league_scoreboard",
            description: "Get matchups and scores for a specific week",
            parameters: {
              type: "object",
              properties: {
                leagueKey: { type: "string", description: "The league key" },
                week: { type: "number", description: "Week number (optional, defaults to current week)" }
              },
              required: ["leagueKey"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_player_stats",
            description: "Get detailed stats for specific players",
            parameters: {
              type: "object",
              properties: {
                playerKeys: { type: "array", items: { type: "string" }, description: "Array of player keys" }
              },
              required: ["playerKeys"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_free_agents",
            description: "Get list of available players in a league",
            parameters: {
              type: "object",
              properties: {
                leagueKey: { type: "string", description: "The league key" },
                sort: { type: "string", description: "Sort option (e.g., 'rank', 'name')" }
              },
              required: ["leagueKey"]
            }
          }
        }
      ];

      const messages: OpenAI.ChatCompletionMessageParam[] = [
        ...(conversationHistory || []),
        { role: "user", content: message }
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.7,
      });

      const assistantMessage = response.choices[0].message;
      res.json({
        message: assistantMessage.content || "",
        toolCalls: assistantMessage.tool_calls || [],
        finishReason: response.choices[0].finish_reason,
      });
    } catch (error: any) {
      console.error('Error in chat endpoint:', error);
      res.status(500).json({ error: error.message || 'Chat request failed' });
    }
  });
}
