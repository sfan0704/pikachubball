/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeagueRankings from '../../../../../client/src/components/features/league/LeagueRankings';
import type { TeamRanking, RankingsMetadata } from '@shared/schema';

// Sample test data
const createMockRankings = (): TeamRanking[] => [
  {
    teamKey: '466.l.12345.t.1',
    teamName: 'Team One',
    managerName: 'Manager 1',
    totalRank: 2.5,
    stats: {
      fgPct: 0.485,
      ftPct: 0.820,
      tpm: 150,
      pts: 1200,
      reb: 500,
      ast: 300,
      stl: 100,
      blk: 50,
      to: 120,
    },
    categoryRanks: {
      fgPct: 2,
      ftPct: 1,
      tpm: 3,
      pts: 2,
      reb: 4,
      ast: 2,
      stl: 3,
      blk: 4,
      to: 2,
    },
  },
  {
    teamKey: '466.l.12345.t.2',
    teamName: 'Team Two',
    managerName: 'Manager 2',
    totalRank: 3.8,
    stats: {
      fgPct: 0.465,
      ftPct: 0.780,
      tpm: 180,
      pts: 1350,
      reb: 450,
      ast: 280,
      stl: 90,
      blk: 60,
      to: 150,
    },
    categoryRanks: {
      fgPct: 4,
      ftPct: 3,
      tpm: 1,
      pts: 1,
      reb: 6,
      ast: 4,
      stl: 5,
      blk: 2,
      to: 5,
    },
  },
  {
    teamKey: '466.l.12345.t.3',
    teamName: 'Team Three',
    managerName: 'Manager 3',
    totalRank: 1.5,
    stats: {
      fgPct: 0.505,
      ftPct: 0.800,
      tpm: 160,
      pts: 1100,
      reb: 600,
      ast: 320,
      stl: 110,
      blk: 70,
      to: 100,
    },
    categoryRanks: {
      fgPct: 1,
      ftPct: 2,
      tpm: 2,
      pts: 3,
      reb: 1,
      ast: 1,
      stl: 1,
      blk: 1,
      to: 1,
    },
  },
];

const createMockMetadata = (): RankingsMetadata => ({
  scope: 'season',
  currentWeek: 10,
  totalWeeks: 20,
});

describe('LeagueRankings', () => {
  let mockRankings: TeamRanking[];
  let mockMetadata: RankingsMetadata;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRankings = createMockRankings();
    mockMetadata = createMockMetadata();
  });

  describe('rendering', () => {
    it('should render the rankings card', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT
      expect(screen.getByTestId('card-league-rankings')).toBeInTheDocument();
    });

    it('should render the title', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT
      expect(screen.getByTestId('heading-rankings')).toBeInTheDocument();
      expect(screen.getByText('9-Cat Master Rankings')).toBeInTheDocument();
    });

    it('should render all team rows', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT
      mockRankings.forEach(team => {
        expect(screen.getByText(team.teamName)).toBeInTheDocument();
      });
    });

    it('should render view toggle switch', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT
      expect(screen.getByTestId('switch-view-toggle')).toBeInTheDocument();
    });

    it('should render category headers', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT
      expect(screen.getByTestId('header-fgpct')).toBeInTheDocument();
      expect(screen.getByTestId('header-ftpct')).toBeInTheDocument();
      expect(screen.getByTestId('header-tpm')).toBeInTheDocument();
      expect(screen.getByTestId('header-pts')).toBeInTheDocument();
      expect(screen.getByTestId('header-reb')).toBeInTheDocument();
      expect(screen.getByTestId('header-ast')).toBeInTheDocument();
      expect(screen.getByTestId('header-stl')).toBeInTheDocument();
      expect(screen.getByTestId('header-blk')).toBeInTheDocument();
      expect(screen.getByTestId('header-to')).toBeInTheDocument();
      expect(screen.getByTestId('header-avg')).toBeInTheDocument();
    });
  });

  describe('rankings display', () => {
    it('should display category ranks by default', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT - Team One has FG% rank of 2
      const teamOneRow = screen.getByTestId('row-ranking-466.l.12345.t.1');
      expect(teamOneRow).toHaveTextContent('2'); // FG% rank
    });

    it('should display total rank for each team', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT
      expect(screen.getByText('2.5')).toBeInTheDocument(); // Team One total rank
      expect(screen.getByText('3.8')).toBeInTheDocument(); // Team Two total rank
      expect(screen.getByText('1.5')).toBeInTheDocument(); // Team Three total rank
    });

    it('should sort by totalRank ascending by default', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT - Team Three (1.5) should be first, then Team One (2.5), then Team Two (3.8)
      const rows = screen.getAllByTestId(/^row-ranking-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'row-ranking-466.l.12345.t.3');
      expect(rows[1]).toHaveAttribute('data-testid', 'row-ranking-466.l.12345.t.1');
      expect(rows[2]).toHaveAttribute('data-testid', 'row-ranking-466.l.12345.t.2');
    });
  });

  describe('user team highlighting', () => {
    it('should highlight user team row', () => {
      // ARRANGE & ACT
      render(
        <LeagueRankings 
          rankings={mockRankings} 
          metadata={mockMetadata} 
          userTeamKey="466.l.12345.t.2"
        />
      );

      // ASSERT
      const userTeamRow = screen.getByTestId('row-ranking-466.l.12345.t.2');
      expect(userTeamRow).toHaveClass('bg-primary/5');
    });

    it('should show star icon for user team', () => {
      // ARRANGE & ACT
      render(
        <LeagueRankings 
          rankings={mockRankings} 
          metadata={mockMetadata} 
          userTeamKey="466.l.12345.t.1"
        />
      );

      // ASSERT
      const userTeamRow = screen.getByTestId('row-ranking-466.l.12345.t.1');
      expect(userTeamRow).toHaveTextContent('★');
    });

    it('should not highlight non-user team rows', () => {
      // ARRANGE & ACT
      render(
        <LeagueRankings 
          rankings={mockRankings} 
          metadata={mockMetadata} 
          userTeamKey="466.l.12345.t.1"
        />
      );

      // ASSERT
      const otherTeamRow = screen.getByTestId('row-ranking-466.l.12345.t.2');
      expect(otherTeamRow).not.toHaveClass('bg-primary/5');
    });
  });

  describe('view toggle', () => {
    it('should show "Rankings" label by default', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT
      expect(screen.getByText('Rankings')).toBeInTheDocument();
    });

    it('should switch to "Actual Stats" label when toggled', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ACT
      await user.click(screen.getByTestId('switch-view-toggle'));

      // ASSERT
      expect(screen.getByText('Actual Stats')).toBeInTheDocument();
    });

    it('should display actual stats after toggle', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ACT
      await user.click(screen.getByTestId('switch-view-toggle'));

      // ASSERT - Should show stat values instead of ranks
      // Team One has 1200 pts
      expect(screen.getByText('1200')).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('should sort by PTS when PTS header is clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ACT
      await user.click(screen.getByTestId('header-pts'));

      // ASSERT - Should be sorted by PTS rank (ascending): Team Two=1, Team One=2, Team Three=3
      const rows = screen.getAllByTestId(/^row-ranking-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'row-ranking-466.l.12345.t.2');
      expect(rows[1]).toHaveAttribute('data-testid', 'row-ranking-466.l.12345.t.1');
      expect(rows[2]).toHaveAttribute('data-testid', 'row-ranking-466.l.12345.t.3');
    });

    it('should toggle sort direction when clicking same header twice', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ACT - Click PTS twice
      await user.click(screen.getByTestId('header-pts'));
      await user.click(screen.getByTestId('header-pts'));

      // ASSERT - Should be sorted descending: Team Three=3, Team One=2, Team Two=1
      const rows = screen.getAllByTestId(/^row-ranking-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'row-ranking-466.l.12345.t.3');
      expect(rows[1]).toHaveAttribute('data-testid', 'row-ranking-466.l.12345.t.1');
      expect(rows[2]).toHaveAttribute('data-testid', 'row-ranking-466.l.12345.t.2');
    });
  });

  describe('manager name display', () => {
    it('should display manager names', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT
      expect(screen.getByText('Manager 1')).toBeInTheDocument();
      expect(screen.getByText('Manager 2')).toBeInTheDocument();
      expect(screen.getByText('Manager 3')).toBeInTheDocument();
    });
  });

  describe('rank badges', () => {
    it('should display 1st badge for top ranked team', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT
      expect(screen.getByText('1st')).toBeInTheDocument();
    });

    it('should display 2nd badge for second ranked team', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT
      expect(screen.getByText('2nd')).toBeInTheDocument();
    });

    it('should display 3rd badge for third ranked team', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={mockRankings} metadata={mockMetadata} />);

      // ASSERT
      expect(screen.getByText('3rd')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should render table with no rows when rankings is empty', () => {
      // ARRANGE & ACT
      render(<LeagueRankings rankings={[]} metadata={mockMetadata} />);

      // ASSERT
      expect(screen.getByTestId('card-league-rankings')).toBeInTheDocument();
      expect(screen.queryByTestId(/^row-ranking-/)).not.toBeInTheDocument();
    });
  });
});
