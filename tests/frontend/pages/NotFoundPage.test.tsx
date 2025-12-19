/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotFound from '../../../client/src/pages/NotFoundPage';

describe('NotFoundPage', () => {
  it('should render 404 heading', () => {
    // ARRANGE & ACT
    render(<NotFound />);

    // ASSERT
    expect(screen.getByText(/404 Page Not Found/i)).toBeInTheDocument();
  });

  it('should render helpful message', () => {
    // ARRANGE & ACT
    render(<NotFound />);

    // ASSERT
    expect(screen.getByText(/Did you forget to add the page to the router/i)).toBeInTheDocument();
  });

  it('should render error icon', () => {
    // ARRANGE & ACT
    const { container } = render(<NotFound />);

    // ASSERT
    // Check for the AlertCircle icon (SVG element)
    const svgIcon = container.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
  });

  it('should be centered on the page', () => {
    // ARRANGE & ACT
    const { container } = render(<NotFound />);

    // ASSERT
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('flex');
    expect(wrapper).toHaveClass('items-center');
    expect(wrapper).toHaveClass('justify-center');
  });
});
