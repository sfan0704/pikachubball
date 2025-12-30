/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../../../client/src/lib/auth';

// Mock apiRequest
const mockApiRequest = vi.fn();
vi.mock('../../../client/src/lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
    clear: vi.fn(),
  },
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('auth', () => {
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

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );

  describe('useAuth', () => {
    it('should throw error when used outside AuthProvider', () => {
      // ARRANGE
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // ACT & ASSERT
      expect(() => {
        renderHook(() => useAuth(), {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        });
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });

    it('should return context when used within AuthProvider', () => {
      // ARRANGE & ACT
      const { result } = renderHook(() => useAuth(), { wrapper });

      // ASSERT
      expect(result.current).toBeDefined();
      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBeDefined();
      expect(result.current.login).toBeInstanceOf(Function);
      expect(result.current.logout).toBeInstanceOf(Function);
    });

    it('should return isLoading true initially', () => {
      // ARRANGE - Make query hang to test loading state
      mockFetch.mockImplementation(() => new Promise(() => {}));

      // ACT
      const { result } = renderHook(() => useAuth(), { wrapper });

      // ASSERT
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('AuthProvider', () => {
    it('should render children', () => {
      // ARRANGE & ACT
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <div data-testid="child">Child content</div>
          </AuthProvider>
        </QueryClientProvider>
      );

      // ASSERT
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should set user when query returns user data', async () => {
      // ARRANGE
      queryClient.setQueryData(['/api/auth/me'], { user: { id: '1', username: 'testuser' } });

      // ACT
      const { result } = renderHook(() => useAuth(), { wrapper });

      // ASSERT
      await waitFor(() => {
        expect(result.current.user).toEqual({ id: '1', username: 'testuser' });
      });
    });

    it('should set user to null when query returns no user', async () => {
      // ARRANGE
      queryClient.setQueryData(['/api/auth/me'], { user: null });

      // ACT
      const { result } = renderHook(() => useAuth(), { wrapper });

      // ASSERT
      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });
    });
  });

  describe('login', () => {
    it('should call apiRequest with correct arguments', async () => {
      // ARRANGE
      const mockUser = { id: '1', username: 'testuser' };
      mockApiRequest.mockResolvedValue({ user: mockUser });
      const { result } = renderHook(() => useAuth(), { wrapper });

      // ACT
      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      // ASSERT
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/api/auth/login',
        'POST',
        { username: 'testuser', password: 'password123' }
      );
    });

    it('should update user after successful login', async () => {
      // ARRANGE
      const mockUser = { id: '1', username: 'testuser' };
      mockApiRequest.mockResolvedValue({ user: mockUser });
      const { result } = renderHook(() => useAuth(), { wrapper });

      // ACT
      await act(async () => {
        await result.current.login('testuser', 'password123');
      });

      // ASSERT
      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });
    });
  });

  describe('logout', () => {
    it('should call apiRequest for logout', async () => {
      // ARRANGE
      mockApiRequest.mockResolvedValue(undefined);
      const { result } = renderHook(() => useAuth(), { wrapper });

      // ACT
      await act(async () => {
        await result.current.logout();
      });

      // ASSERT
      expect(mockApiRequest).toHaveBeenCalledWith('/api/auth/logout', 'POST', {});
    });

    it('should clear user after logout', async () => {
      // ARRANGE
      queryClient.setQueryData(['/api/auth/me'], { user: { id: '1', username: 'testuser' } });
      mockApiRequest.mockResolvedValue(undefined);
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial user to be set
      await waitFor(() => {
        expect(result.current.user).toEqual({ id: '1', username: 'testuser' });
      });

      // ACT
      await act(async () => {
        await result.current.logout();
      });

      // ASSERT
      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });
    });
  });
});
