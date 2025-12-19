/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import YahooCredentialsSetupModal from '../../../../../client/src/components/features/auth/YahooCredentialsSetupModal';

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

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
    readText: vi.fn(),
  },
  writable: true,
  configurable: true,
});

describe('YahooCredentialsSetupModal', () => {
  let queryClient: QueryClient;
  const originalSessionStorage = window.sessionStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a fresh mock for sessionStorage each test
    const store: Record<string, string> = {};
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          Object.keys(store).forEach(key => delete store[key]);
        }),
      },
      writable: true,
      configurable: true,
    });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
        },
      },
    });

    // Default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ redirectUri: 'http://localhost:5000/api/auth/yahoo/callback' }),
    });
  });

  const renderModal = (open = true, onOpenChange = vi.fn()) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <YahooCredentialsSetupModal open={open} onOpenChange={onOpenChange} />
      </QueryClientProvider>
    );
  };

  describe('visibility', () => {
    it('should render dialog when open is true', async () => {
      // ARRANGE & ACT
      renderModal(true);

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('Set Up Yahoo OAuth Credentials')).toBeInTheDocument();
      });
    });

    it('should not render dialog when open is false', () => {
      // ARRANGE & ACT
      renderModal(false);

      // ASSERT
      expect(screen.queryByText('Set Up Yahoo OAuth Credentials')).not.toBeInTheDocument();
    });
  });

  describe('content when open', () => {
    it('should display title and description', async () => {
      // ARRANGE & ACT
      renderModal(true);

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('Set Up Yahoo OAuth Credentials')).toBeInTheDocument();
        expect(screen.getByText(/To use this app, you need to provide your own Yahoo OAuth credentials/i)).toBeInTheDocument();
      });
    });

    it('should display form labels', async () => {
      // ARRANGE & ACT
      renderModal(true);

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('Yahoo Client ID')).toBeInTheDocument();
        expect(screen.getByText('Yahoo Client Secret')).toBeInTheDocument();
      });
    });

    it('should display action buttons', async () => {
      // ARRANGE & ACT
      renderModal(true);

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Save Credentials & Connect/i)).toBeInTheDocument();
        expect(screen.getByText('Skip for now')).toBeInTheDocument();
      });
    });

    it('should display redirect URI section', async () => {
      // ARRANGE & ACT
      renderModal(true);

      // ASSERT
      await waitFor(() => {
        // Use more specific text since "Redirect URI" appears multiple times
        expect(screen.getByText(/Redirect URI \(add this to your Yahoo app\)/i)).toBeInTheDocument();
        expect(screen.getByText('Copy')).toBeInTheDocument();
      });
    });
  });

  describe('redirect URI handling', () => {
    it('should fetch and display redirect URI', async () => {
      // ARRANGE
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ redirectUri: 'http://test.example.com/callback' }),
      });

      // ACT
      renderModal(true);

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('http://test.example.com/callback')).toBeInTheDocument();
      });
    });

    it('should have a clickable copy button', async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ redirectUri: 'http://test.example.com/callback' }),
      });
      renderModal(true);

      // Wait for URI to load
      await waitFor(() => {
        expect(screen.getByText('http://test.example.com/callback')).toBeInTheDocument();
      });

      // ASSERT - Copy button should be present and clickable
      const copyButton = screen.getByText('Copy');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).not.toBeDisabled();

      // ACT - Just verify we can click without error
      await user.click(copyButton);
    });
  });

  describe('skip functionality', () => {
    it('should call onOpenChange when skip is clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderModal(true, onOpenChange);

      // Wait for modal to be visible
      await waitFor(() => {
        expect(screen.getByText('Skip for now')).toBeInTheDocument();
      });

      // ACT
      await user.click(screen.getByText('Skip for now'));

      // ASSERT
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('form inputs', () => {
    it('should have input fields for Client ID and Secret', async () => {
      // ARRANGE & ACT
      renderModal(true);

      // ASSERT
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter your Yahoo Client ID/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Enter your Yahoo Client Secret/i)).toBeInTheDocument();
      });
    });
  });

  describe('external links', () => {
    it('should have link to Yahoo Developer Portal', async () => {
      // ARRANGE & ACT
      renderModal(true);

      // ASSERT
      await waitFor(() => {
        const link = screen.getByRole('link', { name: /Yahoo Developer Portal/i });
        expect(link).toHaveAttribute('href', 'https://developer.yahoo.com/apps/');
        expect(link).toHaveAttribute('target', '_blank');
      });
    });
  });
});
