/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RankingsPage from '../../../client/src/pages/RankingsPage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock useLocation and useSearch from wouter
vi.mock('wouter', () => ({
  useLocation: () => ['/', vi.fn()],
  useSearch: () => '',
}));

// Mock useAuth hook
const mockLogout = vi.fn();
vi.mock('../../../client/src/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'testuser' },
    logout: mockLogout,
    login: vi.fn(),
    signup: vi.fn(),
    isLoading: false,
  }),
}));

// Mock useChat hook
const mockOpenChat = vi.fn();
const mockSetSelectedTeamKey = vi.fn();
vi.mock('../../../client/src/lib/chatContext', () => ({
  useChat: () => ({
    openChat: mockOpenChat,
    setSelectedTeamKey: mockSetSelectedTeamKey,
    selectedTeamKey: null,
  }),
}));

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('../../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock useFirstLeague hook - with connected state
vi.mock('../../../client/src/hooks/useFirstLeague', () => ({
  useFirstLeague: () => ({
    leagues: [
      {
        leagueKey: '466.l.12345',
        leagueName: 'Test League',
        teamKey: '466.l.12345.t.1',
        teamName: 'Test Team',
      },
    ],
    selectedLeagueKey: '466.l.12345',
    setSelectedLeagueKey: vi.fn(),
    selectedLeague: {
      leagueKey: '466.l.12345',
      leagueName: 'Test League',
      teamKey: '466.l.12345.t.1',
      teamName: 'Test Team',
    },
    isLoadingLeagues: false,
    error: null,
  }),
}));

// Mock YahooCredentialsSetupModal to prevent blocking
vi.mock('../../../client/src/components/features/auth/YahooCredentialsSetupModal', () => ({
  default: () => null, // Render nothing
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('RankingsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    document.documentElement.classList.remove('dark');

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
        },
      },
    });

    // Default fetch mocks - all return connected/valid state
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/settings/yahoo-credentials')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ hasCredentials: true, updatedAt: '2024-01-01' }),
        });
      }
      if (url.includes('/api/auth/yahoo/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ connected: true, hasValidToken: true, hasCredentials: true }),
        });
      }
      if (url.includes('/api/yahoo/league-rankings')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            rankings: [
              {
                teamKey: '466.l.12345.t.1',
                teamName: 'Test Team',
                managerName: 'Manager',
                totalRank: 2.5,
                stats: { fgPct: 0.48, ftPct: 0.82, tpm: 150, pts: 1200, reb: 500, ast: 300, stl: 100, blk: 50, to: 120 },
                categoryRanks: { fgPct: 2, ftPct: 1, tpm: 3, pts: 2, reb: 4, ast: 2, stl: 3, blk: 4, to: 2 },
              },
            ],
            metadata: { scope: 'season', currentWeek: 10, totalWeeks: 20 },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  const renderRankingsPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <RankingsPage />
      </QueryClientProvider>
    );
  };

  describe('header', () => {
    it('should render app title', async () => {
      // ARRANGE & ACT
      renderRankingsPage();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('heading-app-title')).toBeInTheDocument();
      });
    });

    it('should render user username', async () => {
      // ARRANGE & ACT
      renderRankingsPage();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('text-username')).toHaveTextContent('testuser');
      });
    });

    it('should render chat button', async () => {
      // ARRANGE & ACT
      renderRankingsPage();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('button-header-chat')).toBeInTheDocument();
      });
    });

    it('should render logout button', async () => {
      // ARRANGE & ACT
      renderRankingsPage();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('button-logout')).toBeInTheDocument();
      });
    });

    it('should render settings button', async () => {
      // ARRANGE & ACT
      renderRankingsPage();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('button-settings')).toBeInTheDocument();
      });
    });

    it('should render theme toggle button', async () => {
      // ARRANGE & ACT
      renderRankingsPage();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('button-theme-toggle')).toBeInTheDocument();
      });
    });
  });

  describe('page content', () => {
    it('should render page heading', async () => {
      // ARRANGE & ACT
      renderRankingsPage();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('heading-rankings-page')).toBeInTheDocument();
        expect(screen.getByTestId('heading-rankings-page')).toHaveTextContent('9-Cat Master Rankings');
      });
    });

    it('should render page description', async () => {
      // ARRANGE & ACT
      renderRankingsPage();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/See where every team truly stands/i)).toBeInTheDocument();
      });
    });
  });

  describe('interactions', () => {
    it('should open chat when chat button is clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderRankingsPage();

      // ACT
      await waitFor(() => {
        expect(screen.getByTestId('button-header-chat')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('button-header-chat'));

      // ASSERT
      expect(mockOpenChat).toHaveBeenCalled();
    });

    it('should call logout when logout button is clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderRankingsPage();

      // ACT
      await waitFor(() => {
        expect(screen.getByTestId('button-logout')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('button-logout'));

      // ASSERT
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });
  });

  describe('structure', () => {
    it('should render a container with min-h-screen', () => {
      // ARRANGE & ACT
      const { container } = renderRankingsPage();

      // ASSERT
      const mainDiv = container.querySelector('.min-h-screen');
      expect(mainDiv).toBeInTheDocument();
    });

    it('should render sticky header', () => {
      // ARRANGE & ACT
      const { container } = renderRankingsPage();

      // ASSERT
      const header = container.querySelector('header.sticky');
      expect(header).toBeInTheDocument();
    });

    it('should render header with navigation buttons', () => {
      // ARRANGE & ACT
      renderRankingsPage();

      // ASSERT - Check that all navigation buttons are rendered
      expect(screen.getByTestId('button-header-chat')).toBeInTheDocument();
      expect(screen.getByTestId('button-settings')).toBeInTheDocument();
      expect(screen.getByTestId('button-theme-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('button-logout')).toBeInTheDocument();
    });
  });
});
