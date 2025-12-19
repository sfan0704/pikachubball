import type OpenAI from "openai";

/**
 * OpenAI Tools Configuration
 * Defines MCP tools as OpenAI function calling tools
 */
export function getOpenAITools(): OpenAI.ChatCompletionTool[] {
  return [
    {
      type: "function",
      function: {
        name: "get_user_leagues",
        description:
          "Get all fantasy basketball leagues for the authenticated user",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_league_standings",
        description: "Get current standings for a specific league",
        parameters: {
          type: "object",
          properties: {
            leagueKey: {
              type: "string",
              description: "The league key (e.g., '466.l.29849')",
            },
          },
          required: ["leagueKey"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_team_roster",
        description: "Get the roster for a specific team",
        parameters: {
          type: "object",
          properties: {
            teamKey: {
              type: "string",
              description: "The team key (e.g., '466.l.29849.t.10')",
            },
          },
          required: ["teamKey"],
        },
      },
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
            week: {
              type: "number",
              description:
                "Week number (optional, defaults to current week)",
            },
          },
          required: ["leagueKey"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_player_stats",
        description: "Get detailed stats for specific players",
        parameters: {
          type: "object",
          properties: {
            playerKeys: {
              type: "array",
              items: { type: "string" },
              description: "Array of player keys",
            },
          },
          required: ["playerKeys"],
        },
      },
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
            sort: {
              type: "string",
              description: "Sort option (e.g., 'rank', 'name')",
            },
          },
          required: ["leagueKey"],
        },
      },
    },
  ];
}

