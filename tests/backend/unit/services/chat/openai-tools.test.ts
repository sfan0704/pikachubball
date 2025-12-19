import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOpenAITools } from '../../../../../server/services/chat/openai-tools';

describe('openai-tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOpenAITools', () => {
    it('should return array of OpenAI tools', () => {
      // ARRANGE & ACT
      const tools = getOpenAITools();

      // ASSERT
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include get_user_leagues tool', () => {
      // ARRANGE & ACT
      const tools = getOpenAITools();

      // ASSERT
      const userLeaguesTool = tools.find(t => t.function.name === 'get_user_leagues');
      expect(userLeaguesTool).toBeDefined();
      expect(userLeaguesTool?.type).toBe('function');
      expect(userLeaguesTool?.function.description).toContain('fantasy basketball leagues');
    });

    it('should include get_league_standings tool with required parameters', () => {
      // ARRANGE & ACT
      const tools = getOpenAITools();

      // ASSERT
      const standingsTool = tools.find(t => t.function.name === 'get_league_standings');
      expect(standingsTool).toBeDefined();
      expect(standingsTool?.function.parameters).toBeDefined();
      expect(standingsTool?.function.parameters.required).toContain('leagueKey');
    });

    it('should include get_team_roster tool', () => {
      // ARRANGE & ACT
      const tools = getOpenAITools();

      // ASSERT
      const rosterTool = tools.find(t => t.function.name === 'get_team_roster');
      expect(rosterTool).toBeDefined();
      expect(rosterTool?.function.parameters.required).toContain('teamKey');
    });

    it('should include get_league_scoreboard tool', () => {
      // ARRANGE & ACT
      const tools = getOpenAITools();

      // ASSERT
      const scoreboardTool = tools.find(t => t.function.name === 'get_league_scoreboard');
      expect(scoreboardTool).toBeDefined();
      expect(scoreboardTool?.function.parameters.required).toContain('leagueKey');
      expect(scoreboardTool?.function.parameters.properties.week).toBeDefined();
    });

    it('should include get_player_stats tool', () => {
      // ARRANGE & ACT
      const tools = getOpenAITools();

      // ASSERT
      const playerStatsTool = tools.find(t => t.function.name === 'get_player_stats');
      expect(playerStatsTool).toBeDefined();
      expect(playerStatsTool?.function.parameters.required).toContain('playerKeys');
      expect(playerStatsTool?.function.parameters.properties.playerKeys.type).toBe('array');
    });

    it('should include get_free_agents tool', () => {
      // ARRANGE & ACT
      const tools = getOpenAITools();

      // ASSERT
      const freeAgentsTool = tools.find(t => t.function.name === 'get_free_agents');
      expect(freeAgentsTool).toBeDefined();
      expect(freeAgentsTool?.function.parameters.required).toContain('leagueKey');
    });

    it('should return consistent results on multiple calls', () => {
      // ARRANGE & ACT
      const tools1 = getOpenAITools();
      const tools2 = getOpenAITools();

      // ASSERT
      expect(tools1).toEqual(tools2);
      expect(tools1.length).toBe(tools2.length);
    });

    it('should have all tools with function type', () => {
      // ARRANGE & ACT
      const tools = getOpenAITools();

      // ASSERT
      tools.forEach(tool => {
        expect(tool.type).toBe('function');
        expect(tool.function).toBeDefined();
        expect(tool.function.name).toBeDefined();
        expect(tool.function.description).toBeDefined();
      });
    });
  });
});

