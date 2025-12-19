/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import YahooConnect from '../../../../../client/src/components/features/auth/YahooConnect';

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('../../../../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock queryClient functions
vi.mock('../../../../../client/src/lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
  apiRequest: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
});

describe('YahooConnect', () => {
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

  const renderYahooConnect = (statusResponse: any) => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/auth/yahoo/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => statusResponse,
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <YahooConnect />
      </QueryClientProvider>
    );
  };

  describe('loading state', () => {
    it('should show loading spinner initially', async () => {
      // ARRANGE - Mock a delayed response
      mockFetch.mockImplementation(() => new Promise(() => {}));

      // ACT
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <YahooConnect />
        </QueryClientProvider>
      );

      // ASSERT - Should show the loading spinner (animate-spin class)
      await waitFor(() => {
        const spinner = container.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      });
    });
  });

  describe('no credentials state', () => {
    it('should show setup message when no credentials', async () => {
      // ARRANGE & ACT
      renderYahooConnect({
        hasCredentials: false,
        connected: false,
        hasValidToken: false,
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Add your Yahoo API credentials/i)).toBeInTheDocument();
      });
    });

    it('should show disabled setup button when no credentials', async () => {
      // ARRANGE & ACT
      renderYahooConnect({
        hasCredentials: false,
        connected: false,
        hasValidToken: false,
      });

      // ASSERT
      await waitFor(() => {
        const button = screen.getByTestId('button-setup-credentials');
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
      });
    });

    it('should show Not Connected badge when no credentials', async () => {
      // ARRANGE & ACT
      renderYahooConnect({
        hasCredentials: false,
        connected: false,
        hasValidToken: false,
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('badge-connection-status')).toHaveTextContent('Not Connected');
      });
    });
  });

  describe('not connected state (with credentials)', () => {
    it('should show connect button when has credentials but not connected', async () => {
      // ARRANGE - Pre-populate query cache
      queryClient.setQueryData(['/api/auth/yahoo/status'], {
        hasCredentials: true,
        connected: false,
        hasValidToken: false,
      });

      // ACT
      render(
        <QueryClientProvider client={queryClient}>
          <YahooConnect />
        </QueryClientProvider>
      );

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('button-connect-yahoo')).toBeInTheDocument();
        expect(screen.getByTestId('button-connect-yahoo')).toHaveTextContent('Connect Yahoo');
      });
    });

    it('should show connect message when has credentials but not connected', async () => {
      // ARRANGE - Pre-populate query cache
      queryClient.setQueryData(['/api/auth/yahoo/status'], {
        hasCredentials: true,
        connected: false,
        hasValidToken: false,
      });

      // ACT
      render(
        <QueryClientProvider client={queryClient}>
          <YahooConnect />
        </QueryClientProvider>
      );

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Connect your Yahoo Fantasy account/i)).toBeInTheDocument();
      });
    });
  });

  describe('connected state', () => {
    it('should not render anything when connected', async () => {
      // ARRANGE & ACT
      const { container } = renderYahooConnect({
        hasCredentials: true,
        connected: true,
        hasValidToken: true,
      });

      // ASSERT - Component returns null when connected
      await waitFor(() => {
        // The container should be empty (no card rendered)
        expect(container.querySelector('[data-testid="badge-connection-status"]')).not.toBeInTheDocument();
      });
    });
  });

  describe('connect button interaction', () => {
    it('should initiate OAuth when connect button is clicked', async () => {
      // ARRANGE - Pre-populate query cache
      queryClient.setQueryData(['/api/auth/yahoo/status'], {
        hasCredentials: true,
        connected: false,
        hasValidToken: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
        }),
      });

      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queryClient}>
          <YahooConnect />
        </QueryClientProvider>
      );

      // ACT
      await waitFor(() => {
        expect(screen.getByTestId('button-connect-yahoo')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('button-connect-yahoo'));

      // ASSERT
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/yahoo', expect.anything());
      });
    });

    it('should show error toast when connect fails', async () => {
      // ARRANGE - Pre-populate query cache
      queryClient.setQueryData(['/api/auth/yahoo/status'], {
        hasCredentials: true,
        connected: false,
        hasValidToken: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Authentication failed',
        }),
      });

      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queryClient}>
          <YahooConnect />
        </QueryClientProvider>
      );

      // ACT
      await waitFor(() => {
        expect(screen.getByTestId('button-connect-yahoo')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('button-connect-yahoo'));

      // ASSERT
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Connection Failed',
            variant: 'destructive',
          })
        );
      });
    });
  });

  describe('card content', () => {
    it('should show Yahoo Fantasy title', async () => {
      // ARRANGE & ACT
      renderYahooConnect({
        hasCredentials: true,
        connected: false,
        hasValidToken: false,
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('Yahoo Fantasy')).toBeInTheDocument();
      });
    });
  });
});
