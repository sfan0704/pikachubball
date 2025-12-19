/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamRoster from '../../../../../client/src/components/features/league/TeamRoster';

interface Player {
  name: string;
  position: string;
  team: string;
  status: 'active' | 'injured' | 'out';
}

const createMockPlayers = (): Player[] => [
  { name: 'LeBron James', position: 'SF', team: 'LAL', status: 'active' },
  { name: 'Stephen Curry', position: 'PG', team: 'GSW', status: 'active' },
  { name: 'Kevin Durant', position: 'PF', team: 'PHX', status: 'injured' },
  { name: 'Kawhi Leonard', position: 'SF', team: 'LAC', status: 'out' },
];

describe('TeamRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the roster heading', () => {
      // ARRANGE & ACT
      render(<TeamRoster players={createMockPlayers()} />);

      // ASSERT
      expect(screen.getByTestId('heading-roster')).toBeInTheDocument();
      expect(screen.getByText('My Roster')).toBeInTheDocument();
    });

    it('should render all players', () => {
      // ARRANGE
      const players = createMockPlayers();

      // ACT
      render(<TeamRoster players={players} />);

      // ASSERT
      players.forEach((player, idx) => {
        expect(screen.getByTestId(`roster-player-${idx}`)).toBeInTheDocument();
      });
    });

    it('should display player names', () => {
      // ARRANGE
      const players = createMockPlayers();

      // ACT
      render(<TeamRoster players={players} />);

      // ASSERT
      players.forEach(player => {
        expect(screen.getByText(player.name)).toBeInTheDocument();
      });
    });

    it('should display player position and team', () => {
      // ARRANGE
      const players = createMockPlayers();

      // ACT
      render(<TeamRoster players={players} />);

      // ASSERT
      expect(screen.getByText(/SF • LAL/)).toBeInTheDocument();
      expect(screen.getByText(/PG • GSW/)).toBeInTheDocument();
    });

    it('should display player status badges', () => {
      // ARRANGE & ACT
      render(<TeamRoster players={createMockPlayers()} />);

      // ASSERT
      const badges = screen.getAllByTestId('badge-status');
      expect(badges).toHaveLength(4);
    });
  });

  describe('status colors', () => {
    it('should display green styling for active players', () => {
      // ARRANGE
      const players: Player[] = [
        { name: 'Active Player', position: 'PG', team: 'LAL', status: 'active' },
      ];

      // ACT
      render(<TeamRoster players={players} />);

      // ASSERT
      const badge = screen.getByTestId('badge-status');
      expect(badge).toHaveClass('text-green-600');
    });

    it('should display yellow styling for injured players', () => {
      // ARRANGE
      const players: Player[] = [
        { name: 'Injured Player', position: 'SG', team: 'BOS', status: 'injured' },
      ];

      // ACT
      render(<TeamRoster players={players} />);

      // ASSERT
      const badge = screen.getByTestId('badge-status');
      expect(badge).toHaveClass('text-yellow-600');
    });

    it('should display red styling for out players', () => {
      // ARRANGE
      const players: Player[] = [
        { name: 'Out Player', position: 'C', team: 'MIA', status: 'out' },
      ];

      // ACT
      render(<TeamRoster players={players} />);

      // ASSERT
      const badge = screen.getByTestId('badge-status');
      expect(badge).toHaveClass('text-red-600');
    });
  });

  describe('status text', () => {
    it('should display "active" text for active players', () => {
      // ARRANGE
      const players: Player[] = [
        { name: 'Active Player', position: 'PG', team: 'LAL', status: 'active' },
      ];

      // ACT
      render(<TeamRoster players={players} />);

      // ASSERT
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('should display "injured" text for injured players', () => {
      // ARRANGE
      const players: Player[] = [
        { name: 'Injured Player', position: 'SG', team: 'BOS', status: 'injured' },
      ];

      // ACT
      render(<TeamRoster players={players} />);

      // ASSERT
      expect(screen.getByText('injured')).toBeInTheDocument();
    });

    it('should display "out" text for out players', () => {
      // ARRANGE
      const players: Player[] = [
        { name: 'Out Player', position: 'C', team: 'MIA', status: 'out' },
      ];

      // ACT
      render(<TeamRoster players={players} />);

      // ASSERT
      expect(screen.getByText('out')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should render heading with no players when array is empty', () => {
      // ARRANGE & ACT
      render(<TeamRoster players={[]} />);

      // ASSERT
      expect(screen.getByTestId('heading-roster')).toBeInTheDocument();
      expect(screen.queryByTestId('roster-player-0')).not.toBeInTheDocument();
    });
  });

  describe('multiple players', () => {
    it('should render players in order', () => {
      // ARRANGE
      const players = createMockPlayers();

      // ACT
      render(<TeamRoster players={players} />);

      // ASSERT
      const playerElements = screen.getAllByTestId(/^roster-player-/);
      expect(playerElements).toHaveLength(4);
      expect(playerElements[0]).toHaveTextContent('LeBron James');
      expect(playerElements[1]).toHaveTextContent('Stephen Curry');
      expect(playerElements[2]).toHaveTextContent('Kevin Durant');
      expect(playerElements[3]).toHaveTextContent('Kawhi Leonard');
    });

    it('should have correct count of status badges', () => {
      // ARRANGE
      const players: Player[] = [
        { name: 'Player 1', position: 'PG', team: 'LAL', status: 'active' },
        { name: 'Player 2', position: 'SG', team: 'LAL', status: 'active' },
        { name: 'Player 3', position: 'SF', team: 'LAL', status: 'injured' },
      ];

      // ACT
      render(<TeamRoster players={players} />);

      // ASSERT
      const badges = screen.getAllByTestId('badge-status');
      expect(badges).toHaveLength(3);
    });
  });
});
