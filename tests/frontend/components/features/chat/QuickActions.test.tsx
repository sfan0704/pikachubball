/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickActions from '../../../../../client/src/components/features/chat/QuickActions';

describe('QuickActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render all four quick action buttons', () => {
      // ARRANGE & ACT
      render(<QuickActions onActionClick={vi.fn()} />);

      // ASSERT
      expect(screen.getByTestId('button-quick-start-sit')).toBeInTheDocument();
      expect(screen.getByTestId('button-quick-waiver')).toBeInTheDocument();
      expect(screen.getByTestId('button-quick-trades')).toBeInTheDocument();
      expect(screen.getByTestId('button-quick-matchup')).toBeInTheDocument();
    });

    it('should render button labels correctly', () => {
      // ARRANGE & ACT
      render(<QuickActions onActionClick={vi.fn()} />);

      // ASSERT
      expect(screen.getByText('Start/Sit Today')).toBeInTheDocument();
      expect(screen.getByText('Waiver Wire')).toBeInTheDocument();
      expect(screen.getByText('Trade Suggestions')).toBeInTheDocument();
      expect(screen.getByText('Matchup Analysis')).toBeInTheDocument();
    });

    it('should render icons in each button', () => {
      // ARRANGE & ACT
      const { container } = render(<QuickActions onActionClick={vi.fn()} />);

      // ASSERT
      // Each button should contain an SVG icon
      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        const icon = button.querySelector('svg');
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe('interactions', () => {
    it('should call onActionClick with "start-sit" when Start/Sit button is clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      const mockOnActionClick = vi.fn();
      render(<QuickActions onActionClick={mockOnActionClick} />);

      // ACT
      await user.click(screen.getByTestId('button-quick-start-sit'));

      // ASSERT
      expect(mockOnActionClick).toHaveBeenCalledTimes(1);
      expect(mockOnActionClick).toHaveBeenCalledWith('start-sit');
    });

    it('should call onActionClick with "waiver" when Waiver Wire button is clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      const mockOnActionClick = vi.fn();
      render(<QuickActions onActionClick={mockOnActionClick} />);

      // ACT
      await user.click(screen.getByTestId('button-quick-waiver'));

      // ASSERT
      expect(mockOnActionClick).toHaveBeenCalledTimes(1);
      expect(mockOnActionClick).toHaveBeenCalledWith('waiver');
    });

    it('should call onActionClick with "trades" when Trade button is clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      const mockOnActionClick = vi.fn();
      render(<QuickActions onActionClick={mockOnActionClick} />);

      // ACT
      await user.click(screen.getByTestId('button-quick-trades'));

      // ASSERT
      expect(mockOnActionClick).toHaveBeenCalledTimes(1);
      expect(mockOnActionClick).toHaveBeenCalledWith('trades');
    });

    it('should call onActionClick with "matchup" when Matchup button is clicked', async () => {
      // ARRANGE
      const user = userEvent.setup();
      const mockOnActionClick = vi.fn();
      render(<QuickActions onActionClick={mockOnActionClick} />);

      // ACT
      await user.click(screen.getByTestId('button-quick-matchup'));

      // ASSERT
      expect(mockOnActionClick).toHaveBeenCalledTimes(1);
      expect(mockOnActionClick).toHaveBeenCalledWith('matchup');
    });

    it('should handle multiple button clicks', async () => {
      // ARRANGE
      const user = userEvent.setup();
      const mockOnActionClick = vi.fn();
      render(<QuickActions onActionClick={mockOnActionClick} />);

      // ACT
      await user.click(screen.getByTestId('button-quick-start-sit'));
      await user.click(screen.getByTestId('button-quick-waiver'));

      // ASSERT
      expect(mockOnActionClick).toHaveBeenCalledTimes(2);
      expect(mockOnActionClick).toHaveBeenNthCalledWith(1, 'start-sit');
      expect(mockOnActionClick).toHaveBeenNthCalledWith(2, 'waiver');
    });
  });

  describe('styling', () => {
    it('should render buttons with outline variant', () => {
      // ARRANGE & ACT
      const { container } = render(<QuickActions onActionClick={vi.fn()} />);

      // ASSERT
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(4);
    });

    it('should have a container with border', () => {
      // ARRANGE & ACT
      const { container } = render(<QuickActions onActionClick={vi.fn()} />);

      // ASSERT
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('border-b');
    });
  });
});
