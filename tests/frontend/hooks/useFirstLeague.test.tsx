/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFirstLeague } from '../../../client/src/hooks/useFirstLeague';
import type { League } from '@shared/schema';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useFirstLeague', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
          queryFn: async ({ queryKey }) => {
            const url = Array.isArray(queryKey) ? queryKey.join('/') : queryKey as string;
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) {
              throw new Error(`${res.status}: ${res.statusText}`);
            }
            return res.json();
          },
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should return empty leagues when loading', async () => {
    // ARRANGE
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagues: [] }),
    });

    // ACT
    const { result } = renderHook(() => useFirstLeague(), { wrapper });

    // ASSERT
    // Initially loading
    expect(result.current.isLoadingLeagues).toBe(true);
    expect(result.current.leagues).toEqual([]);
    expect(result.current.selectedLeagueKey).toBe('');

    // Wait for query to complete
    await waitFor(() => {
      expect(result.current.isLoadingLeagues).toBe(false);
    }, { timeout: 2000 });
  });

  it('should auto-select first league when leagues load', async () => {
    // ARRANGE
    const mockLeagues: League[] = [
      {
        leagueKey: '466.l.12345',
        leagueName: 'League 1',
        teamKey: '466.l.12345.t.1',
        teamName: 'Team 1',
        season: 2024,
        gameKey: '466',
      },
      {
        leagueKey: '466.l.67890',
        leagueName: 'League 2',
        teamKey: '466.l.67890.t.2',
        teamName: 'Team 2',
        season: 2024,
        gameKey: '466',
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagues: mockLeagues }),
    });

    // ACT
    const { result } = renderHook(() => useFirstLeague(), { wrapper });

    // ASSERT
    await waitFor(() => {
      expect(result.current.isLoadingLeagues).toBe(false);
    }, { timeout: 2000 });

    await waitFor(() => {
      expect(result.current.selectedLeagueKey).toBeTruthy();
    }, { timeout: 2000 });

    expect(result.current.leagues).toHaveLength(2);
    expect(result.current.selectedLeagueKey).toBe(mockLeagues[0].leagueKey);
    expect(result.current.selectedLeague).toEqual(mockLeagues[0]);
  });

  it('should select league with highest season', async () => {
    // ARRANGE
    const mockLeagues: League[] = [
      {
        leagueKey: '466.l.12345',
        leagueName: 'League 2023',
        teamKey: '466.l.12345.t.1',
        teamName: 'Team 1',
        season: 2023,
        gameKey: '466',
      },
      {
        leagueKey: '466.l.67890',
        leagueName: 'League 2024',
        teamKey: '466.l.67890.t.2',
        teamName: 'Team 2',
        season: 2024,
        gameKey: '466',
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagues: mockLeagues }),
    });

    // ACT
    const { result } = renderHook(() => useFirstLeague(), { wrapper });

    // ASSERT
    await waitFor(() => {
      expect(result.current.isLoadingLeagues).toBe(false);
    }, { timeout: 2000 });

    await waitFor(() => {
      expect(result.current.selectedLeagueKey).toBe('466.l.67890'); // Should select 2024 season
    }, { timeout: 2000 });

    expect(result.current.selectedLeague?.season).toBe(2024);
  });

  it('should select league with highest game key when seasons are equal', async () => {
    // ARRANGE
    const mockLeagues: League[] = [
      {
        leagueKey: '466.l.12345',
        leagueName: 'League 1',
        teamKey: '466.l.12345.t.1',
        teamName: 'Team 1',
        season: 2024,
        gameKey: '466',
      },
      {
        leagueKey: '466.l.67890',
        leagueName: 'League 2',
        teamKey: '466.l.67890.t.2',
        teamName: 'Team 2',
        season: 2024,
        gameKey: '467', // Higher game key
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagues: mockLeagues }),
    });

    // ACT
    const { result } = renderHook(() => useFirstLeague(), { wrapper });

    // ASSERT
    await waitFor(() => {
      expect(result.current.isLoadingLeagues).toBe(false);
    }, { timeout: 2000 });

    await waitFor(() => {
      // Should select league with higher game key
      expect(result.current.selectedLeagueKey).toBe('466.l.67890');
    }, { timeout: 2000 });
  });

  it('should allow manual league selection', async () => {
    // ARRANGE
    const mockLeagues: League[] = [
      {
        leagueKey: '466.l.12345',
        leagueName: 'League 1',
        teamKey: '466.l.12345.t.1',
        teamName: 'Team 1',
        season: 2024,
        gameKey: '466',
      },
      {
        leagueKey: '466.l.67890',
        leagueName: 'League 2',
        teamKey: '466.l.67890.t.2',
        teamName: 'Team 2',
        season: 2024,
        gameKey: '466',
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagues: mockLeagues }),
    });

    // ACT
    const { result } = renderHook(() => useFirstLeague(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingLeagues).toBe(false);
    }, { timeout: 2000 });

    // Manually select second league
    result.current.setSelectedLeagueKey('466.l.67890');

    // ASSERT
    await waitFor(() => {
      expect(result.current.selectedLeagueKey).toBe('466.l.67890');
      expect(result.current.selectedLeague?.leagueKey).toBe('466.l.67890');
    }, { timeout: 2000 });
  });

  describe('status and remembered selection', () => {
    const league = (key: string, overrides: Partial<League> = {}): League => ({
      leagueKey: key,
      leagueName: key,
      teamKey: `${key}.t.1`,
      teamName: 'Team',
      season: 2026,
      gameKey: '470',
      ...overrides,
    });
    const respondWith = (leagues: League[]) =>
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ leagues }) });

    it('prefers an active league over a newer preseason or finished one', async () => {
      respondWith([
        league('466.l.1', { season: 2025, gameKey: '466', status: 'finished' }),
        league('470.l.2', { status: 'preseason' }),
        league('466.l.3', { season: 2025, gameKey: '466', status: 'active' }),
      ]);

      const { result } = renderHook(() => useFirstLeague(), { wrapper });

      await waitFor(() => expect(result.current.selectedLeagueKey).toBe('466.l.3'));
    });

    it('restores an explicit selection after a reload, even a past season', async () => {
      const leagues = [
        league('470.l.2', { status: 'active' }),
        league('466.l.1', { season: 2025, gameKey: '466', status: 'finished' }),
      ];
      respondWith(leagues);
      const first = renderHook(() => useFirstLeague(), { wrapper });
      await waitFor(() => expect(first.result.current.selectedLeagueKey).toBe('470.l.2'));

      first.result.current.setSelectedLeagueKey('466.l.1');
      first.unmount();
      queryClient.clear();
      const reloaded = renderHook(() => useFirstLeague(), { wrapper });

      await waitFor(() => expect(reloaded.result.current.selectedLeagueKey).toBe('466.l.1'));
    });

    it('keeps the explicit selection when discovery results change', async () => {
      respondWith([league('470.l.2', { status: 'active' }), league('466.l.1', { status: 'finished' })]);
      const { result } = renderHook(() => useFirstLeague(), { wrapper });
      await waitFor(() => expect(result.current.selectedLeagueKey).toBe('470.l.2'));
      result.current.setSelectedLeagueKey('466.l.1');

      respondWith([
        league('470.l.9', { status: 'active', season: 2027 }),
        league('470.l.2', { status: 'active' }),
        league('466.l.1', { status: 'finished' }),
      ]);
      await queryClient.refetchQueries({ queryKey: ['/api/yahoo/leagues'] });

      await waitFor(() => expect(result.current.leagues).toHaveLength(3));
      expect(result.current.selectedLeagueKey).toBe('466.l.1');
    });

    it('ignores a remembered league that is no longer available', async () => {
      window.localStorage.setItem('pikachubball:selected-league', '999.l.0');
      respondWith([league('470.l.2', { status: 'active' })]);

      const { result } = renderHook(() => useFirstLeague(), { wrapper });

      await waitFor(() => expect(result.current.selectedLeagueKey).toBe('470.l.2'));
    });
  });

  it('should handle empty leagues array', async () => {
    // ARRANGE
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagues: [] }),
    });

    // ACT
    const { result } = renderHook(() => useFirstLeague(), { wrapper });

    // ASSERT
    await waitFor(() => {
      expect(result.current.isLoadingLeagues).toBe(false);
    });

    expect(result.current.leagues).toEqual([]);
    expect(result.current.selectedLeagueKey).toBe('');
    expect(result.current.selectedLeague).toBeUndefined();
  });

  it('should handle API error', async () => {
    // ARRANGE
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    // ACT
    const { result } = renderHook(() => useFirstLeague(), { wrapper });

    // ASSERT
    await waitFor(() => {
      expect(result.current.isLoadingLeagues).toBe(false);
    }, { timeout: 2000 });

    expect(result.current.error).toBeDefined();
    expect(result.current.leagues).toEqual([]);
  });
});
