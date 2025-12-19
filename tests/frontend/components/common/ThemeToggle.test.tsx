/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from '../../../../client/src/components/common/ThemeToggle';

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

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Remove dark class before each test
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    localStorageMock.clear();
    document.documentElement.classList.remove('dark');
  });

  describe('rendering', () => {
    it('should render theme toggle button', () => {
      // ARRANGE & ACT
      render(<ThemeToggle />);

      // ASSERT
      expect(screen.getByTestId('button-theme-toggle')).toBeInTheDocument();
    });

    it('should render icon in button', () => {
      // ARRANGE & ACT
      const { container } = render(<ThemeToggle />);

      // ASSERT
      const button = container.querySelector('[data-testid="button-theme-toggle"]');
      const icon = button?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('theme initialization', () => {
    it('should default to light theme when no stored preference', () => {
      // ARRANGE & ACT
      render(<ThemeToggle />);

      // ASSERT
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should use dark theme from localStorage', () => {
      // ARRANGE
      localStorageMock.getItem.mockReturnValue('dark');

      // ACT
      render(<ThemeToggle />);

      // ASSERT
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('theme toggling', () => {
    it('should toggle from light to dark on click', async () => {
      // ARRANGE
      localStorageMock.getItem.mockReturnValue(null); // Explicitly set to null for light theme
      const user = userEvent.setup();
      render(<ThemeToggle />);

      // ACT
      await user.click(screen.getByTestId('button-theme-toggle'));

      // ASSERT
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should toggle from dark to light on click', async () => {
      // ARRANGE
      localStorageMock.getItem.mockReturnValue('dark');
      const user = userEvent.setup();
      render(<ThemeToggle />);

      // ACT
      await user.click(screen.getByTestId('button-theme-toggle'));

      // ASSERT
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('button behavior', () => {
    it('should be clickable', async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<ThemeToggle />);

      // ACT
      const button = screen.getByTestId('button-theme-toggle');

      // ASSERT
      expect(button).not.toBeDisabled();
      await user.click(button);
    });

    it('should be a button element', () => {
      // ARRANGE & ACT
      render(<ThemeToggle />);

      // ASSERT
      const button = screen.getByTestId('button-theme-toggle');
      expect(button.tagName).toBe('BUTTON');
    });
  });
});
