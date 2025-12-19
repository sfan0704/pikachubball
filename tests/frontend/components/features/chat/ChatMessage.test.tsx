/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatMessage from '../../../../../client/src/components/features/chat/ChatMessage';

describe('ChatMessage', () => {
  it('should render user message', () => {
    // ARRANGE & ACT
    render(
      <ChatMessage
        role="user"
        content="Hello, how can I help?"
      />
    );

    // ASSERT
    expect(screen.getByTestId('message-user')).toBeInTheDocument();
    expect(screen.getByText('Hello, how can I help?')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-user')).toBeInTheDocument();
  });

  it('should render assistant message', () => {
    // ARRANGE & ACT
    render(
      <ChatMessage
        role="assistant"
        content="I can help you with your fantasy team!"
      />
    );

    // ASSERT
    expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
    expect(screen.getByText('I can help you with your fantasy team!')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-assistant')).toBeInTheDocument();
  });

  it('should render sources when provided', () => {
    // ARRANGE
    const sources = ['BALLDONTLIE', 'Reddit', 'ESPN'];

    // ACT
    render(
      <ChatMessage
        role="assistant"
        content="Based on recent analysis..."
        sources={sources}
      />
    );

    // ASSERT
    expect(screen.getByTestId('message-sources')).toBeInTheDocument();
    expect(screen.getByTestId('badge-source-0')).toHaveTextContent('BALLDONTLIE');
    expect(screen.getByTestId('badge-source-1')).toHaveTextContent('Reddit');
    expect(screen.getByTestId('badge-source-2')).toHaveTextContent('ESPN');
  });

  it('should render timestamp when provided', () => {
    // ARRANGE & ACT
    render(
      <ChatMessage
        role="user"
        content="Test message"
        timestamp="2:30 PM"
      />
    );

    // ASSERT
    expect(screen.getByTestId('message-timestamp')).toBeInTheDocument();
    expect(screen.getByText('2:30 PM')).toBeInTheDocument();
  });

  it('should not render sources section when sources are not provided', () => {
    // ARRANGE & ACT
    render(
      <ChatMessage
        role="assistant"
        content="Test message"
      />
    );

    // ASSERT
    expect(screen.queryByTestId('message-sources')).not.toBeInTheDocument();
  });

  it('should not render timestamp when not provided', () => {
    // ARRANGE & ACT
    render(
      <ChatMessage
        role="user"
        content="Test message"
      />
    );

    // ASSERT
    expect(screen.queryByTestId('message-timestamp')).not.toBeInTheDocument();
  });

  it('should render empty sources array without error', () => {
    // ARRANGE & ACT
    render(
      <ChatMessage
        role="assistant"
        content="Test message"
        sources={[]}
      />
    );

    // ASSERT
    expect(screen.queryByTestId('message-sources')).not.toBeInTheDocument();
  });

  it('should preserve whitespace in message content', () => {
    // ARRANGE
    const content = 'Line 1\nLine 2\nLine 3';

    // ACT
    const { container } = render(
      <ChatMessage
        role="assistant"
        content={content}
      />
    );

    // ASSERT
    // Check that the paragraph element contains the content with whitespace preserved
    const paragraph = container.querySelector('p');
    expect(paragraph).toBeInTheDocument();
    // The component uses whitespace-pre-wrap, so newlines should be preserved
    // Check that the text includes the newline characters
    expect(paragraph?.textContent).toContain('Line 1');
    expect(paragraph?.textContent).toContain('Line 2');
    expect(paragraph?.textContent).toContain('Line 3');
    // Verify whitespace-pre-wrap class is applied
    expect(paragraph).toHaveClass('whitespace-pre-wrap');
  });

  it('should align user messages to the right', () => {
    // ARRANGE
    const { container } = render(
      <ChatMessage
        role="user"
        content="Test message"
      />
    );

    // ASSERT
    const messageContainer = container.firstChild as HTMLElement;
    expect(messageContainer).toHaveClass('justify-end');
  });

  it('should align assistant messages to the left', () => {
    // ARRANGE
    const { container } = render(
      <ChatMessage
        role="assistant"
        content="Test message"
      />
    );

    // ASSERT
    const messageContainer = container.firstChild as HTMLElement;
    expect(messageContainer).toHaveClass('justify-start');
  });
});
