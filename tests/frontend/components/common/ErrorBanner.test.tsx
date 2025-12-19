/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBanner } from '../../../../client/src/components/common/ErrorBanner';

describe('ErrorBanner', () => {
  it('should render error banner with title and message', () => {
    // ARRANGE & ACT
    render(
      <ErrorBanner
        title="Error Title"
        message="Error message content"
      />
    );

    // ASSERT
    expect(screen.getByText('Error Title')).toBeInTheDocument();
    expect(screen.getByText('Error message content')).toBeInTheDocument();
  });

  it('should show dismiss button by default', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(
      <ErrorBanner
        title="Error Title"
        message="Error message"
      />
    );

    // ASSERT - Find button by its icon (X)
    const dismissButton = container.querySelector('button[aria-label], button:has(svg)') as HTMLButtonElement;
    expect(dismissButton).toBeInTheDocument();

    // ACT - Click dismiss
    await user.click(dismissButton);

    // ASSERT - Banner should be removed
    expect(screen.queryByText('Error Title')).not.toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { container } = render(
      <ErrorBanner
        title="Error Title"
        message="Error message"
        onDismiss={onDismiss}
      />
    );

    // ACT - Find the dismiss button (icon button with X)
    const dismissButton = container.querySelector('button:has(svg)') as HTMLButtonElement;
    await user.click(dismissButton);

    // ASSERT
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should show retry button when onRetry is provided', () => {
    // ARRANGE
    const onRetry = vi.fn();
    render(
      <ErrorBanner
        title="Error Title"
        message="Error message"
        onRetry={onRetry}
      />
    );

    // ASSERT
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ErrorBanner
        title="Error Title"
        message="Error message"
        onRetry={onRetry}
      />
    );

    // ACT
    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    // ASSERT
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should hide dismiss button when dismissible is false', () => {
    // ARRANGE
    const { container } = render(
      <ErrorBanner
        title="Error Title"
        message="Error message"
        dismissible={false}
      />
    );

    // ASSERT - Should only have retry button if onRetry is provided, or no buttons
    // Since we don't provide onRetry, there should be no buttons
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });

  it('should use destructive variant by default', () => {
    // ARRANGE
    const { container } = render(
      <ErrorBanner
        title="Error Title"
        message="Error message"
      />
    );

    // ASSERT
    // Check that Alert component is rendered (destructive variant adds specific classes)
    expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
  });

  it('should render both retry and dismiss buttons', () => {
    // ARRANGE
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    const { container } = render(
      <ErrorBanner
        title="Error Title"
        message="Error message"
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
    );

    // ASSERT
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // Dismiss button is icon-only, find it by checking for buttons
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2); // Retry + Dismiss
  });
});
