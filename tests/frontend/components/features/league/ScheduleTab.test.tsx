/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScheduleTab from '../../../../../client/src/components/features/league/ScheduleTab';

describe('ScheduleTab', () => {
  let queryClient: QueryClient;

  const mockScheduleData = {
    myTeam: {
      teamKey: '466.l.12345.t.1',
      teamName: 'My Team',
      totalGames: 25,
      schedule: [
        { date: '2024-01-15', dayOfWeek: 'Mon', gameCount: 4 },
        { date: '2024-01-16', dayOfWeek: 'Tue', gameCount: 3 },
        { date: '2024-01-17', dayOfWeek: 'Wed', gameCount: 5 },
        { date: '2024-01-18', dayOfWeek: 'Thu', gameCount: 2 },
        { date: '2024-01-19', dayOfWeek: 'Fri', gameCount: 4 },
        { date: '2024-01-20', dayOfWeek: 'Sat', gameCount: 3 },
        { date: '2024-01-21', dayOfWeek: 'Sun', gameCount: 4 },
      ],
    },
    opponent: {
      teamKey: '466.l.12345.t.2',
      teamName: 'Opponent Team',
      totalGames: 23,
      schedule: [
        { date: '2024-01-15', dayOfWeek: 'Mon', gameCount: 3 },
        { date: '2024-01-16', dayOfWeek: 'Tue', gameCount: 4 },
        { date: '2024-01-17', dayOfWeek: 'Wed', gameCount: 4 },
        { date: '2024-01-18', dayOfWeek: 'Thu', gameCount: 3 },
        { date: '2024-01-19', dayOfWeek: 'Fri', gameCount: 3 },
        { date: '2024-01-20', dayOfWeek: 'Sat', gameCount: 2 },
        { date: '2024-01-21', dayOfWeek: 'Sun', gameCount: 4 },
      ],
    },
    metadata: { week: 5, currentWeek: 10, totalWeeks: 20 },
    isPlaceholder: false,
    placeholderMessage: null,
  };

  const mockPlaceholderData = {
    myTeam: { teamKey: '466.l.12345.t.1', teamName: 'My Team', totalGames: 0, schedule: [] },
    opponent: null,
    metadata: { week: 5, currentWeek: 10, totalWeeks: 20 },
    isPlaceholder: true,
    placeholderMessage: 'Schedule data requires external NBA API integration.',
  };

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

  const renderScheduleTab = (props = { leagueKey: '466.l.12345', teamKey: '466.l.12345.t.1', week: null as number | null }) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ScheduleTab {...props} />
      </QueryClientProvider>
    );
  };

  describe('loading state', () => {
    it('should show loading message while fetching data', () => {
      // ARRANGE & ACT
      renderScheduleTab();

      // ASSERT
      expect(screen.getByText(/Loading schedule/i)).toBeInTheDocument();
    });
  });

  describe('no data state', () => {
    it('should show no data message when schedule data is null', async () => {
      // ARRANGE
      const scheduleUrl = '/api/viz/schedule/466.l.12345/466.l.12345.t.1';
      queryClient.setQueryData([scheduleUrl], null);

      // ACT
      renderScheduleTab();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/No schedule data available/i)).toBeInTheDocument();
      });
    });
  });

  describe('placeholder state', () => {
    it('should show feature unavailable alert when isPlaceholder is true', async () => {
      // ARRANGE
      const scheduleUrl = '/api/viz/schedule/466.l.12345/466.l.12345.t.1';
      queryClient.setQueryData([scheduleUrl], mockPlaceholderData);

      // ACT
      renderScheduleTab();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('card-schedule')).toBeInTheDocument();
        expect(screen.getByText('Feature Unavailable')).toBeInTheDocument();
      });
    });

    it('should show placeholder message', async () => {
      // ARRANGE
      const scheduleUrl = '/api/viz/schedule/466.l.12345/466.l.12345.t.1';
      queryClient.setQueryData([scheduleUrl], mockPlaceholderData);

      // ACT
      renderScheduleTab();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Schedule data requires external NBA API integration/i)).toBeInTheDocument();
      });
    });

    it('should show feature description list', async () => {
      // ARRANGE
      const scheduleUrl = '/api/viz/schedule/466.l.12345/466.l.12345.t.1';
      queryClient.setQueryData([scheduleUrl], mockPlaceholderData);

      // ACT
      renderScheduleTab();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText(/Number of games each of your players/i)).toBeInTheDocument();
      });
    });
  });

  describe('with data', () => {
    it('should render schedule card', async () => {
      // ARRANGE
      const scheduleUrl = '/api/viz/schedule/466.l.12345/466.l.12345.t.1';
      queryClient.setQueryData([scheduleUrl], mockScheduleData);

      // ACT
      renderScheduleTab();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('card-schedule')).toBeInTheDocument();
      });
    });

    it('should display Games Remaining Schedule title', async () => {
      // ARRANGE
      const scheduleUrl = '/api/viz/schedule/466.l.12345/466.l.12345.t.1';
      queryClient.setQueryData([scheduleUrl], mockScheduleData);

      // ACT
      renderScheduleTab();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('Games Remaining Schedule')).toBeInTheDocument();
      });
    });

    it('should display total games for both teams', async () => {
      // ARRANGE
      const scheduleUrl = '/api/viz/schedule/466.l.12345/466.l.12345.t.1';
      queryClient.setQueryData([scheduleUrl], mockScheduleData);

      // ACT
      renderScheduleTab();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('25')).toBeInTheDocument(); // My Team total
        expect(screen.getByText('23')).toBeInTheDocument(); // Opponent total
      });
    });

    it('should display team names', async () => {
      // ARRANGE
      const scheduleUrl = '/api/viz/schedule/466.l.12345/466.l.12345.t.1';
      queryClient.setQueryData([scheduleUrl], mockScheduleData);

      // ACT
      renderScheduleTab();

      // ASSERT
      await waitFor(() => {
        expect(screen.getAllByText('My Team').length).toBeGreaterThan(0);
        expect(screen.getByText('Opponent Team')).toBeInTheDocument();
      });
    });

    it('should display days of week in schedule table', async () => {
      // ARRANGE
      const scheduleUrl = '/api/viz/schedule/466.l.12345/466.l.12345.t.1';
      queryClient.setQueryData([scheduleUrl], mockScheduleData);

      // ACT
      renderScheduleTab();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByText('Mon')).toBeInTheDocument();
        expect(screen.getByText('Tue')).toBeInTheDocument();
        expect(screen.getByText('Wed')).toBeInTheDocument();
      });
    });
  });

  describe('URL construction', () => {
    it('should include week parameter when week is provided', async () => {
      // ARRANGE
      const scheduleUrl = '/api/viz/schedule/466.l.12345/466.l.12345.t.1?week=3';
      queryClient.setQueryData([scheduleUrl], mockScheduleData);

      // ACT
      renderScheduleTab({ leagueKey: '466.l.12345', teamKey: '466.l.12345.t.1', week: 3 });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('card-schedule')).toBeInTheDocument();
      });
    });
  });
});
