import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class YahooFantasyMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    const mcpServerPath = path.join(__dirname, "../mcp-servers/yahoo-fantasy/build/index.js");
    
    this.transport = new StdioClientTransport({
      command: "node",
      args: [mcpServerPath],
    });

    this.client = new Client(
      {
        name: "fantasy-basketball-app",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(this.transport);
    this.isConnected = true;
  }

  async setCredentials(accessToken: string, refreshToken: string, expiresAt: number): Promise<void> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    await this.client.callTool({
      name: "set_credentials",
      arguments: {
        accessToken,
        refreshToken,
        expiresAt,
      },
    });
  }

  async getUserLeagues(): Promise<any> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    const result = await this.client.callTool({
      name: "get_user_leagues",
      arguments: {},
    });

    return this.parseToolResult(result);
  }

  async getLeagueStandings(leagueKey: string): Promise<any> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    const result = await this.client.callTool({
      name: "get_league_standings",
      arguments: { leagueKey },
    });

    return this.parseToolResult(result);
  }

  async getTeamRoster(teamKey: string): Promise<any> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    const result = await this.client.callTool({
      name: "get_team_roster",
      arguments: { teamKey },
    });

    return this.parseToolResult(result);
  }

  async getLeagueSettings(leagueKey: string): Promise<any> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    const result = await this.client.callTool({
      name: "get_league_settings",
      arguments: { leagueKey },
    });

    return this.parseToolResult(result);
  }

  async getLeagueScoreboard(leagueKey: string, week?: number): Promise<any> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    const args: any = { leagueKey };
    if (week !== undefined) {
      args.week = week;
    }

    const result = await this.client.callTool({
      name: "get_league_scoreboard",
      arguments: args,
    });

    return this.parseToolResult(result);
  }

  async getPlayerStats(playerKeys: string[]): Promise<any> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    const result = await this.client.callTool({
      name: "get_player_stats",
      arguments: { playerKeys },
    });

    return this.parseToolResult(result);
  }

  async getFreeAgents(
    leagueKey: string,
    options?: {
      position?: string;
      status?: string;
      sort?: string;
      count?: number;
    }
  ): Promise<any> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    const result = await this.client.callTool({
      name: "get_free_agents",
      arguments: {
        leagueKey,
        ...options,
      },
    });

    return this.parseToolResult(result);
  }

  private parseToolResult(result: any): any {
    if (result.isError) {
      const errorText = result.content[0]?.text || "Unknown error";
      throw new Error(errorText);
    }

    const text = result.content[0]?.text;
    if (!text) {
      throw new Error("No content in tool result");
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    this.isConnected = false;
  }
}

// Singleton instance
let mcpClient: YahooFantasyMCPClient | null = null;

export async function getMCPClient(): Promise<YahooFantasyMCPClient> {
  if (!mcpClient) {
    mcpClient = new YahooFantasyMCPClient();
    await mcpClient.connect();
  }
  return mcpClient;
}

export async function closeMCPClient(): Promise<void> {
  if (mcpClient) {
    await mcpClient.disconnect();
    mcpClient = null;
  }
}
