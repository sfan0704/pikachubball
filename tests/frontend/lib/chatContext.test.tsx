/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import { ChatProvider, useChat } from '../../../client/src/lib/chatContext';

describe('chatContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ChatProvider>{children}</ChatProvider>
  );

  describe('useChat', () => {
    it('should throw error when used outside ChatProvider', () => {
      // ARRANGE
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // ACT & ASSERT
      expect(() => {
        renderHook(() => useChat());
      }).toThrow('useChat must be used within ChatProvider');

      consoleError.mockRestore();
    });

    it('should return context when used within ChatProvider', () => {
      // ARRANGE & ACT
      const { result } = renderHook(() => useChat(), { wrapper });

      // ASSERT
      expect(result.current).toBeDefined();
      expect(result.current.isChatOpen).toBe(false);
      expect(result.current.selectedTeamKey).toBeNull();
      expect(result.current.openChat).toBeInstanceOf(Function);
      expect(result.current.closeChat).toBeInstanceOf(Function);
      expect(result.current.toggleChat).toBeInstanceOf(Function);
      expect(result.current.setSelectedTeamKey).toBeInstanceOf(Function);
    });
  });

  describe('ChatProvider', () => {
    it('should render children', () => {
      // ARRANGE & ACT
      render(
        <ChatProvider>
          <div data-testid="child">Child content</div>
        </ChatProvider>
      );

      // ASSERT
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('isChatOpen state', () => {
    it('should default to false', () => {
      // ARRANGE & ACT
      const { result } = renderHook(() => useChat(), { wrapper });

      // ASSERT
      expect(result.current.isChatOpen).toBe(false);
    });
  });

  describe('openChat', () => {
    it('should set isChatOpen to true', () => {
      // ARRANGE
      const { result } = renderHook(() => useChat(), { wrapper });
      expect(result.current.isChatOpen).toBe(false);

      // ACT
      act(() => {
        result.current.openChat();
      });

      // ASSERT
      expect(result.current.isChatOpen).toBe(true);
    });
  });

  describe('closeChat', () => {
    it('should set isChatOpen to false', () => {
      // ARRANGE
      const { result } = renderHook(() => useChat(), { wrapper });
      
      // First open the chat
      act(() => {
        result.current.openChat();
      });
      expect(result.current.isChatOpen).toBe(true);

      // ACT
      act(() => {
        result.current.closeChat();
      });

      // ASSERT
      expect(result.current.isChatOpen).toBe(false);
    });
  });

  describe('toggleChat', () => {
    it('should toggle isChatOpen from false to true', () => {
      // ARRANGE
      const { result } = renderHook(() => useChat(), { wrapper });
      expect(result.current.isChatOpen).toBe(false);

      // ACT
      act(() => {
        result.current.toggleChat();
      });

      // ASSERT
      expect(result.current.isChatOpen).toBe(true);
    });

    it('should toggle isChatOpen from true to false', () => {
      // ARRANGE
      const { result } = renderHook(() => useChat(), { wrapper });
      act(() => {
        result.current.openChat();
      });
      expect(result.current.isChatOpen).toBe(true);

      // ACT
      act(() => {
        result.current.toggleChat();
      });

      // ASSERT
      expect(result.current.isChatOpen).toBe(false);
    });
  });

  describe('selectedTeamKey state', () => {
    it('should default to null', () => {
      // ARRANGE & ACT
      const { result } = renderHook(() => useChat(), { wrapper });

      // ASSERT
      expect(result.current.selectedTeamKey).toBeNull();
    });
  });

  describe('setSelectedTeamKey', () => {
    it('should set selectedTeamKey to a value', () => {
      // ARRANGE
      const { result } = renderHook(() => useChat(), { wrapper });

      // ACT
      act(() => {
        result.current.setSelectedTeamKey('466.l.12345.t.1');
      });

      // ASSERT
      expect(result.current.selectedTeamKey).toBe('466.l.12345.t.1');
    });

    it('should set selectedTeamKey back to null', () => {
      // ARRANGE
      const { result } = renderHook(() => useChat(), { wrapper });
      act(() => {
        result.current.setSelectedTeamKey('466.l.12345.t.1');
      });
      expect(result.current.selectedTeamKey).toBe('466.l.12345.t.1');

      // ACT
      act(() => {
        result.current.setSelectedTeamKey(null);
      });

      // ASSERT
      expect(result.current.selectedTeamKey).toBeNull();
    });

    it('should update selectedTeamKey when changed', () => {
      // ARRANGE
      const { result } = renderHook(() => useChat(), { wrapper });
      act(() => {
        result.current.setSelectedTeamKey('466.l.12345.t.1');
      });

      // ACT
      act(() => {
        result.current.setSelectedTeamKey('466.l.12345.t.2');
      });

      // ASSERT
      expect(result.current.selectedTeamKey).toBe('466.l.12345.t.2');
    });
  });
});
