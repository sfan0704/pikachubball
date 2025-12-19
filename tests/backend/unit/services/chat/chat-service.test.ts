import { describe, it, expect, beforeEach, vi } from 'vitest';
import type OpenAI from 'openai';
import { sendChatMessage, type ChatMessage } from '../../../../../server/services/chat/chat-service';
import { getOpenAITools } from '../../../../../server/services/chat/openai-tools';

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
};

// Mock openai-tools
vi.mock('../../../../../server/services/chat/openai-tools', () => ({
  getOpenAITools: vi.fn(),
}));

describe('chat-service', () => {
  let mockOpenAIClient: typeof mockOpenAI;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenAIClient = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    } as any;
  });

  describe('sendChatMessage', () => {
    it('should send message and return response', async () => {
      // ARRANGE
      const message = 'What is my team ranking?';
      const mockTools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_user_leagues',
            description: 'Get leagues',
            parameters: { type: 'object', properties: {} },
          },
        },
      ];
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Your team is ranked 3rd',
              tool_calls: [],
            },
            finish_reason: 'stop',
          },
        ],
      };

      vi.mocked(getOpenAITools).mockReturnValue(mockTools as any);
      vi.mocked(mockOpenAIClient.chat.completions.create).mockResolvedValue(mockResponse as any);

      // ACT
      const result = await sendChatMessage(mockOpenAIClient as any, message);

      // ASSERT
      expect(getOpenAITools).toHaveBeenCalled();
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{ role: 'user', content: message }],
        tools: mockTools,
        tool_choice: 'auto',
        temperature: 0.7,
      });
      expect(result).toEqual({
        message: 'Your team is ranked 3rd',
        toolCalls: [],
        finishReason: 'stop',
      });
    });

    it('should include conversation history when provided', async () => {
      // ARRANGE
      const message = 'What about last week?';
      const conversationHistory: ChatMessage[] = [
        { role: 'user', content: 'What is my team ranking?' },
        { role: 'assistant', content: 'Your team is ranked 3rd' },
      ];
      const mockTools = [];
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Last week your team was ranked 2nd',
              tool_calls: [],
            },
            finish_reason: 'stop',
          },
        ],
      };

      vi.mocked(getOpenAITools).mockReturnValue(mockTools as any);
      vi.mocked(mockOpenAIClient.chat.completions.create).mockResolvedValue(mockResponse as any);

      // ACT
      const result = await sendChatMessage(mockOpenAIClient as any, message, conversationHistory);

      // ASSERT
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [
          ...conversationHistory,
          { role: 'user', content: message },
        ],
        tools: mockTools,
        tool_choice: 'auto',
        temperature: 0.7,
      });
      expect(result.message).toBe('Last week your team was ranked 2nd');
    });

    it('should handle empty message content', async () => {
      // ARRANGE
      const message = 'What is my team ranking?';
      const mockTools = [];
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [],
            },
            finish_reason: 'stop',
          },
        ],
      };

      vi.mocked(getOpenAITools).mockReturnValue(mockTools as any);
      vi.mocked(mockOpenAIClient.chat.completions.create).mockResolvedValue(mockResponse as any);

      // ACT
      const result = await sendChatMessage(mockOpenAIClient as any, message);

      // ASSERT
      expect(result.message).toBe('');
    });

    it('should handle tool calls in response', async () => {
      // ARRANGE
      const message = 'Get my leagues';
      const mockTools = [];
      const toolCalls = [
        {
          id: 'call-1',
          type: 'function' as const,
          function: {
            name: 'get_user_leagues',
            arguments: '{}',
          },
        },
      ];
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
              tool_calls: toolCalls,
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      vi.mocked(getOpenAITools).mockReturnValue(mockTools as any);
      vi.mocked(mockOpenAIClient.chat.completions.create).mockResolvedValue(mockResponse as any);

      // ACT
      const result = await sendChatMessage(mockOpenAIClient as any, message);

      // ASSERT
      expect(result.toolCalls).toEqual(toolCalls);
      expect(result.finishReason).toBe('tool_calls');
    });

    it('should handle errors from OpenAI API', async () => {
      // ARRANGE
      const message = 'What is my team ranking?';
      const error = new Error('OpenAI API error');
      const mockTools = [];

      vi.mocked(getOpenAITools).mockReturnValue(mockTools as any);
      vi.mocked(mockOpenAIClient.chat.completions.create).mockRejectedValue(error);

      // ACT & ASSERT
      await expect(sendChatMessage(mockOpenAIClient as any, message)).rejects.toThrow('OpenAI API error');
    });
  });
});

