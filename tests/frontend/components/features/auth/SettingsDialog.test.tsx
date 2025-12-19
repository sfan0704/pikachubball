/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsDialog from '../../../../../client/src/components/features/auth/SettingsDialog';

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('../../../../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SettingsDialog', () => {
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

    // Default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/auth/yahoo/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            connected: false,
            hasValidToken: false,
            hasCredentials: false,
          }),
        });
      }
      if (url.includes('/api/settings/yahoo-credentials')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            hasCredentials: false,
            updatedAt: null,
          }),
        });
      }
      if (url.includes('/api/auth/yahoo-redirect-uri') || url.includes('/api/auth/yahoo')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            redirectUri: 'http://localhost:3000/api/auth/yahoo/callback',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  const renderSettingsDialog = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SettingsDialog />
      </QueryClientProvider>
    );
  };

  describe('trigger button', () => {
    it('should render settings trigger button', () => {
      // ARRANGE & ACT
      renderSettingsDialog();

      // ASSERT
      expect(screen.getByTestId('button-settings')).toBeInTheDocument();
    });

    it('should render settings icon in trigger button', () => {
      // ARRANGE & ACT
      const { container } = renderSettingsDialog();

      // ASSERT
      const button = container.querySelector('[data-testid="button-settings"]');
      const icon = button?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('dialog opening', () => {
    it('should open dialog when trigger button is clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderSettingsDialog();

      // ACT
      await user.click(screen.getByTestId('button-settings'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should display dialog title after opening', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderSettingsDialog();

      // ACT
      await user.click(screen.getByTestId('button-settings'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should display dialog description after opening', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderSettingsDialog();

      // ACT
      await user.click(screen.getByTestId('button-settings'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Manage your Yahoo Fantasy API connection/i)).toBeInTheDocument();
      });
    });
  });

  describe('sections', () => {
    it('should display Yahoo OAuth Credentials section', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderSettingsDialog();

      // ACT
      await user.click(screen.getByTestId('button-settings'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('Yahoo OAuth Credentials')).toBeInTheDocument();
      });
    });

    it('should display Yahoo Fantasy Connection section', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderSettingsDialog();

      // ACT
      await user.click(screen.getByTestId('button-settings'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('Yahoo Fantasy Connection')).toBeInTheDocument();
      });
    });
  });

  describe('credential form (no credentials)', () => {
    it('should show credential form when no credentials saved', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderSettingsDialog();

      // ACT
      await user.click(screen.getByTestId('button-settings'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your Yahoo Client ID')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter your Yahoo Client Secret')).toBeInTheDocument();
      });
    });

    it('should show Save Credentials button', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderSettingsDialog();

      // ACT
      await user.click(screen.getByTestId('button-settings'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Credentials/i })).toBeInTheDocument();
      });
    });

    it('should show link to Yahoo Developer Portal', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderSettingsDialog();

      // ACT
      await user.click(screen.getByTestId('button-settings'));

      // ASSERT
      await waitFor(() => {
        const link = screen.getByText('Yahoo Developer Portal');
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://developer.yahoo.com/apps/');
      });
    });
  });

  describe('connection button', () => {
    it('should show Connect to Yahoo button when not connected', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderSettingsDialog();

      // ACT
      await user.click(screen.getByTestId('button-settings'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Connect to Yahoo/i })).toBeInTheDocument();
      });
    });

    it('should disable Connect button when no credentials', async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderSettingsDialog();

      // ACT
      await user.click(screen.getByTestId('button-settings'));

      // ASSERT
      await waitFor(() => {
        const connectButton = screen.getByRole('button', { name: /Connect to Yahoo/i });
        expect(connectButton).toBeDisabled();
      });
    });
  });

  describe('loading state', () => {
    it('should show Loading... initially when dialog opens', async () => {
      // ARRANGE
      const user = userEvent.setup();
      // Make fetch hang to test loading state
      mockFetch.mockImplementation(() => new Promise(() => {}));
      renderSettingsDialog();

      // ACT
      await user.click(screen.getByTestId('button-settings'));

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });
  });
});
