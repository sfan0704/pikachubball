/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatDialog from '../../../../../client/src/components/features/chat/ChatDialog';

// Mock useFirstLeague hook
vi.mock('../../../../../client/src/hooks/useFirstLeague', () => ({
  useFirstLeague: () => ({
    leagues: [
      {
        leagueKey: '466.l.12345',
        leagueName: 'Test League',
        teamKey: '466.l.12345.t.1',
        teamName: 'Test Team',
      },
    ],
    selectedLeague: {
      leagueKey: '466.l.12345',
      leagueName: 'Test League',
      teamKey: '466.l.12345.t.1',
      teamName: 'Test Team',
    },
    selectedLeagueKey: '466.l.12345',
    setSelectedLeagueKey: vi.fn(),
    isLoadingLeagues: false,
    error: null,
  }),
}));

// Mock useChat hook
const mockSetSelectedTeamKey = vi.fn();
vi.mock('../../../../../client/src/lib/chatContext', () => ({
  useChat: () => ({
    selectedTeamKey: '466.l.12345.t.1',
    setSelectedTeamKey: mockSetSelectedTeamKey,
  }),
}));

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('../../../../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('ChatDialog', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
        },
      },
    });
  });

  const renderChatDialog = (props: { open: boolean; onOpenChange: (open: boolean) => void }) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ChatDialog {...props} />
      </QueryClientProvider>
    );
  };

  describe('rendering', () => {
    it('should render dialog title when open', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ASSERT
      expect(screen.getByTestId('heading-chat-title')).toBeInTheDocument();
      expect(screen.getByTestId('heading-chat-title')).toHaveTextContent('Fantasy Basketball AI');
    });

    it('should render welcome message on initial load', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ASSERT
      expect(screen.getByText(/I'm your Fantasy Basketball AI assistant/i)).toBeInTheDocument();
    });

    it('should render quick action buttons', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ASSERT
      expect(screen.getByText('Start/Sit Today')).toBeInTheDocument();
      expect(screen.getByText('Waiver Wire')).toBeInTheDocument();
      expect(screen.getByText('Trade Suggestions')).toBeInTheDocument();
      expect(screen.getByText('Matchup Analysis')).toBeInTheDocument();
    });

    it('should render chat input', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ASSERT
      const textarea = screen.getByTestId('input-chat');
      expect(textarea).toBeInTheDocument();
    });

    it('should render send button', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ASSERT
      const sendButton = screen.getByTestId('button-send');
      expect(sendButton).toBeInTheDocument();
    });

    it('should render team selector for desktop', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ASSERT
      expect(screen.getByText('Select Team')).toBeInTheDocument();
    });
  });

  describe('user interaction', () => {
    it('should allow typing in chat input', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ACT
      const textarea = screen.getByTestId('input-chat');
      await user.type(textarea, 'Hello');

      // ASSERT
      expect(textarea).toHaveValue('Hello');
    });

    it('should disable send button when input is empty', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ASSERT
      const sendButton = screen.getByTestId('button-send');
      expect(sendButton).toBeDisabled();
    });

    it('should enable send button when input has text', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ACT
      const textarea = screen.getByTestId('input-chat');
      await user.type(textarea, 'Test message');

      // ASSERT
      const sendButton = screen.getByTestId('button-send');
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('quick actions', () => {
    it('should render all four quick action buttons', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ASSERT
      expect(screen.getByTestId('button-quick-start-sit')).toBeInTheDocument();
      expect(screen.getByTestId('button-quick-waiver')).toBeInTheDocument();
      expect(screen.getByTestId('button-quick-trades')).toBeInTheDocument();
      expect(screen.getByTestId('button-quick-matchup')).toBeInTheDocument();
    });

    it('should have clickable quick action buttons', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ASSERT
      const startSitButton = screen.getByTestId('button-quick-start-sit');
      expect(startSitButton).not.toBeDisabled();
    });
  });

  describe('dialog state', () => {
    it('should not render content when closed', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: false, onOpenChange: vi.fn() });

      // ASSERT
      expect(screen.queryByTestId('heading-chat-title')).not.toBeInTheDocument();
    });
  });

  describe('initial message', () => {
    it('should display assistant welcome message', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ASSERT
      expect(screen.getByText(/analyze your team/i)).toBeInTheDocument();
    });

    it('should display timestamp on initial message', () => {
      // ARRANGE & ACT
      renderChatDialog({ open: true, onOpenChange: vi.fn() });

      // ASSERT
      expect(screen.getByText('2:30 PM')).toBeInTheDocument();
    });
  });
});
