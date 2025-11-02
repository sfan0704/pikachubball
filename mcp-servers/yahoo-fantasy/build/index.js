#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
let credentials = null;
const CLIENT_ID = process.env.YAHOO_CLIENT_ID;
const CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET;
const REDIRECT_URI = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/yahoo/callback`
    : "http://localhost:5000/api/auth/yahoo/callback";
async function refreshAccessToken(currentRefreshToken) {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error("Yahoo credentials not configured");
    }
    const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const response = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            redirect_uri: REDIRECT_URI,
            grant_type: 'refresh_token',
            refresh_token: currentRefreshToken
        }).toString()
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh token: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    // Yahoo sometimes doesn't return a new refresh token - preserve the current one
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || currentRefreshToken,
        expiresIn: data.expires_in
    };
}
async function ensureValidAccessToken() {
    if (!credentials) {
        throw new Error("Credentials not set. Call set_credentials first.");
    }
    const now = Math.floor(Date.now() / 1000);
    // Refresh if token expires in less than 5 minutes
    if (credentials.expiresAt > now + 300) {
        return credentials.accessToken;
    }
    console.error("Token expired or expiring soon, refreshing...");
    try {
        const currentRefreshToken = credentials.refreshToken;
        const newTokens = await refreshAccessToken(currentRefreshToken);
        // Use fresh timestamp for expiration calculation
        const freshNow = Math.floor(Date.now() / 1000);
        credentials = {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresAt: freshNow + newTokens.expiresIn
        };
        console.error("Token refreshed successfully");
        return credentials.accessToken;
    }
    catch (error) {
        console.error("Failed to refresh token:", error);
        credentials = null;
        throw new Error("Failed to refresh access token. Please re-authenticate.");
    }
}
const server = new Server({
    name: "yahoo-fantasy-server",
    version: "0.1.0",
}, {
    capabilities: {
        tools: {},
    },
});
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "set_credentials",
                description: "Set Yahoo Fantasy API credentials (access token, refresh token, and expiration time)",
                inputSchema: {
                    type: "object",
                    properties: {
                        accessToken: {
                            type: "string",
                            description: "Yahoo OAuth2 access token",
                        },
                        refreshToken: {
                            type: "string",
                            description: "Yahoo OAuth2 refresh token",
                        },
                        expiresAt: {
                            type: "number",
                            description: "Unix timestamp when the access token expires",
                        },
                    },
                    required: ["accessToken", "refreshToken", "expiresAt"],
                },
            },
            {
                name: "get_user_leagues",
                description: "Get all fantasy basketball leagues for the authenticated user",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "get_league_standings",
                description: "Get current standings for a specific league",
                inputSchema: {
                    type: "object",
                    properties: {
                        leagueKey: {
                            type: "string",
                            description: "Yahoo league key (format: nba.l.XXXXX)",
                        },
                    },
                    required: ["leagueKey"],
                },
            },
            {
                name: "get_team_roster",
                description: "Get the current roster for a specific team",
                inputSchema: {
                    type: "object",
                    properties: {
                        teamKey: {
                            type: "string",
                            description: "Yahoo team key (format: nba.l.XXXXX.t.Y)",
                        },
                    },
                    required: ["teamKey"],
                },
            },
            {
                name: "get_league_scoreboard",
                description: "Get current week's matchups and scores for a league",
                inputSchema: {
                    type: "object",
                    properties: {
                        leagueKey: {
                            type: "string",
                            description: "Yahoo league key (format: nba.l.XXXXX)",
                        },
                    },
                    required: ["leagueKey"],
                },
            },
            {
                name: "get_player_stats",
                description: "Get stats for specific players",
                inputSchema: {
                    type: "object",
                    properties: {
                        playerKeys: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of Yahoo player keys (format: nba.p.XXXXX)",
                        },
                    },
                    required: ["playerKeys"],
                },
            },
            {
                name: "get_free_agents",
                description: "Search for available free agent players in a league",
                inputSchema: {
                    type: "object",
                    properties: {
                        leagueKey: {
                            type: "string",
                            description: "Yahoo league key (format: nba.l.XXXXX)",
                        },
                        position: {
                            type: "string",
                            description: "Filter by position (PG, SG, G, SF, PF, F, C, Util)",
                        },
                        status: {
                            type: "string",
                            description: "Filter by player status (A=available)",
                        },
                        sort: {
                            type: "string",
                            description: "Sort criteria (AR=average rank, etc.)",
                        },
                        count: {
                            type: "number",
                            description: "Number of results to return",
                        },
                    },
                    required: ["leagueKey"],
                },
            },
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        if (name === "set_credentials") {
            const typedArgs = args;
            credentials = {
                accessToken: typedArgs.accessToken,
                refreshToken: typedArgs.refreshToken,
                expiresAt: typedArgs.expiresAt,
            };
            return {
                content: [
                    {
                        type: "text",
                        text: "Credentials set successfully",
                    },
                ],
            };
        }
        const accessToken = await ensureValidAccessToken();
        switch (name) {
            case "get_user_leagues": {
                const response = await fetch("https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nba/leagues?format=json", {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!response.ok) {
                    throw new Error(`Yahoo API error: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(data, null, 2),
                        },
                    ],
                };
            }
            case "get_league_standings": {
                const { leagueKey } = args;
                const response = await fetch(`https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!response.ok) {
                    throw new Error(`Yahoo API error: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(data, null, 2),
                        },
                    ],
                };
            }
            case "get_team_roster": {
                const { teamKey } = args;
                const response = await fetch(`https://fantasysports.yahooapis.com/fantasy/v2/team/${teamKey}/roster?format=json`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!response.ok) {
                    throw new Error(`Yahoo API error: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(data, null, 2),
                        },
                    ],
                };
            }
            case "get_league_scoreboard": {
                const { leagueKey } = args;
                const response = await fetch(`https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/scoreboard?format=json`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!response.ok) {
                    throw new Error(`Yahoo API error: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(data, null, 2),
                        },
                    ],
                };
            }
            case "get_player_stats": {
                const { playerKeys } = args;
                const keysParam = playerKeys.join(",");
                const response = await fetch(`https://fantasysports.yahooapis.com/fantasy/v2/players;player_keys=${keysParam}/stats?format=json`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!response.ok) {
                    throw new Error(`Yahoo API error: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(data, null, 2),
                        },
                    ],
                };
            }
            case "get_free_agents": {
                const { leagueKey, position, status, sort, count } = args;
                let url = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/players`;
                const params = new URLSearchParams({ format: "json" });
                if (position)
                    params.append("position", position);
                if (status)
                    params.append("status", status);
                if (sort)
                    params.append("sort", sort);
                if (count)
                    params.append("count", count.toString());
                const response = await fetch(`${url}?${params.toString()}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!response.ok) {
                    throw new Error(`Yahoo API error: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(data, null, 2),
                        },
                    ],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${errorMessage}`,
                },
            ],
            isError: true,
        };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Yahoo Fantasy MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
