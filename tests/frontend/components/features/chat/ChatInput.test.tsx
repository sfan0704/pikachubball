/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from '../../../../../client/src/components/features/chat/ChatInput';

describe('ChatInput', () => {
  it('should render textarea and send button', () => {
    // ARRANGE
    const onSend = vi.fn();
    
    // ACT
    render(<ChatInput onSend={onSend} />);

    // ASSERT
    expect(screen.getByTestId('input-chat')).toBeInTheDocument();
    expect(screen.getByTestId('button-send')).toBeInTheDocument();
  });

  it('should call onSend when send button is clicked', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByTestId('input-chat') as HTMLTextAreaElement;
    const sendButton = screen.getByTestId('button-send');

    // ACT
    await user.type(input, 'Test message');
    await user.click(sendButton);

    // ASSERT
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('Test message');
    expect(input.value).toBe(''); // Input should be cleared
  });

  it('should call onSend when Enter is pressed', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByTestId('input-chat') as HTMLTextAreaElement;

    // ACT
    await user.type(input, 'Test message{Enter}');

    // ASSERT
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('Test message');
    expect(input.value).toBe(''); // Input should be cleared
  });

  it('should not call onSend when Shift+Enter is pressed', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByTestId('input-chat') as HTMLTextAreaElement;

    // ACT
    await user.type(input, 'Test message');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    // ASSERT
    expect(onSend).not.toHaveBeenCalled();
    expect(input.value).toBe('Test message\n'); // Newline should be added
  });

  it('should not call onSend with empty message', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const sendButton = screen.getByTestId('button-send');

    // ACT
    await user.click(sendButton);

    // ASSERT
    expect(onSend).not.toHaveBeenCalled();
  });

  it('should not call onSend with whitespace-only message', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByTestId('input-chat') as HTMLTextAreaElement;
    const sendButton = screen.getByTestId('button-send');

    // ACT
    await user.type(input, '   ');
    await user.click(sendButton);

    // ASSERT
    expect(onSend).not.toHaveBeenCalled();
  });

  it('should trim message before sending', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByTestId('input-chat') as HTMLTextAreaElement;
    const sendButton = screen.getByTestId('button-send');

    // ACT
    await user.type(input, '  Test message  ');
    await user.click(sendButton);

    // ASSERT
    expect(onSend).toHaveBeenCalledWith('Test message'); // Should be trimmed
  });

  it('should disable input and button when disabled prop is true', () => {
    // ARRANGE
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={true} />);

    // ASSERT
    const input = screen.getByTestId('input-chat') as HTMLTextAreaElement;
    const sendButton = screen.getByTestId('button-send');

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('should not call onSend when disabled', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={true} />);

    const input = screen.getByTestId('input-chat') as HTMLTextAreaElement;
    const sendButton = screen.getByTestId('button-send');

    // ACT
    await user.type(input, 'Test message');
    await user.click(sendButton);

    // ASSERT
    expect(onSend).not.toHaveBeenCalled();
  });

  it('should show placeholder text', () => {
    // ARRANGE
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    // ASSERT
    const input = screen.getByPlaceholderText(/Ask about your team/i);
    expect(input).toBeInTheDocument();
  });
});
