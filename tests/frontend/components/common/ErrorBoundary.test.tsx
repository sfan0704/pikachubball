/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../../../../client/src/components/common/ErrorBoundary';

// Component that throws an error on demand
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div data-testid="child-content">Child content</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error during tests since we're testing error handling
  const originalConsoleError = console.error;
  
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
  });
  
  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('when no error occurs', () => {
    it('should render children when no error', () => {
      // ARRANGE & ACT
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      // ASSERT
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should not display error UI when no error', () => {
      // ARRANGE & ACT
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      // ASSERT
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('when error occurs', () => {
    it('should display error UI when child throws', () => {
      // ARRANGE & ACT
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // ASSERT
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should display error description', () => {
      // ARRANGE & ACT
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // ASSERT
      expect(screen.getByText(/An unexpected error occurred/i)).toBeInTheDocument();
    });

    it('should not render children when error occurs', () => {
      // ARRANGE & ACT
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // ASSERT
      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
    });

    it('should render Try Again button', () => {
      // ARRANGE & ACT
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // ASSERT
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    });

    it('should render Reload Page button', () => {
      // ARRANGE & ACT
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // ASSERT
      expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument();
    });

    it('should log error to console', () => {
      // ARRANGE & ACT
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // ASSERT
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('custom fallback', () => {
    it('should render custom fallback when provided', () => {
      // ARRANGE
      const customFallback = <div data-testid="custom-fallback">Custom error message</div>;

      // ACT
      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // ASSERT
      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });

    it('should not render default error UI when custom fallback provided', () => {
      // ARRANGE
      const customFallback = <div>Custom fallback</div>;

      // ACT
      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // ASSERT
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('recovery', () => {
    it('should have Try Again button that is clickable', async () => {
      // ARRANGE
      const user = userEvent.setup();
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Verify error state
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // ASSERT - Try Again button should be enabled and clickable
      const tryAgainButton = screen.getByRole('button', { name: /Try Again/i });
      expect(tryAgainButton).toBeInTheDocument();
      expect(tryAgainButton).not.toBeDisabled();

      // ACT - Should be able to click without throwing
      await user.click(tryAgainButton);
    });
  });

  describe('error display', () => {
    it('should render warning icon', () => {
      // ARRANGE & ACT
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // ASSERT
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have centered layout', () => {
      // ARRANGE & ACT
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // ASSERT
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('items-center');
      expect(wrapper).toHaveClass('justify-center');
    });
  });
});
