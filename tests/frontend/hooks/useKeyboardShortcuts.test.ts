/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../../client/src/hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call onCmdK when Cmd+K is pressed', () => {
    // ARRANGE
    const onCmdK = vi.fn();
    const onEscape = vi.fn();
    const onCmdSlash = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onCmdK, onEscape, onCmdSlash }));

    // ACT
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true, // Cmd on Mac
      ctrlKey: false,
    });
    window.dispatchEvent(event);

    // ASSERT
    expect(onCmdK).toHaveBeenCalledTimes(1);
    expect(onEscape).not.toHaveBeenCalled();
    expect(onCmdSlash).not.toHaveBeenCalled();
  });

  it('should call onCmdK when Ctrl+K is pressed (Windows/Linux)', () => {
    // ARRANGE
    const onCmdK = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onCmdK }));

    // ACT
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: false,
      ctrlKey: true, // Ctrl on Windows/Linux
    });
    window.dispatchEvent(event);

    // ASSERT
    expect(onCmdK).toHaveBeenCalledTimes(1);
  });

  it('should prevent default when Cmd+K is pressed', () => {
    // ARRANGE
    const onCmdK = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onCmdK }));

    // ACT
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    // ASSERT
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should call onEscape when Escape is pressed', () => {
    // ARRANGE
    const onEscape = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onEscape }));

    // ACT
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
    });
    window.dispatchEvent(event);

    // ASSERT
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('should call onCmdSlash when Cmd+/ is pressed', () => {
    // ARRANGE
    const onCmdSlash = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onCmdSlash }));

    // ACT
    const event = new KeyboardEvent('keydown', {
      key: '/',
      metaKey: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    // ASSERT
    expect(onCmdSlash).toHaveBeenCalledTimes(1);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should call onCmdSlash when Ctrl+/ is pressed (Windows/Linux)', () => {
    // ARRANGE
    const onCmdSlash = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onCmdSlash }));

    // ACT
    const event = new KeyboardEvent('keydown', {
      key: '/',
      ctrlKey: true,
    });
    window.dispatchEvent(event);

    // ASSERT
    expect(onCmdSlash).toHaveBeenCalledTimes(1);
  });

  it('should not call callbacks for other keys', () => {
    // ARRANGE
    const onCmdK = vi.fn();
    const onEscape = vi.fn();
    const onCmdSlash = vi.fn();

    renderHook(() => useKeyboardShortcuts({ onCmdK, onEscape, onCmdSlash }));

    // ACT
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      metaKey: true,
    });
    window.dispatchEvent(event);

    // ASSERT
    expect(onCmdK).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();
    expect(onCmdSlash).not.toHaveBeenCalled();
  });

  it('should handle missing callbacks gracefully', () => {
    // ARRANGE
    renderHook(() => useKeyboardShortcuts({}));

    // ACT - Should not throw
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
    });
    
    // ASSERT - Should not throw error
    expect(() => window.dispatchEvent(event)).not.toThrow();
  });

  it('should cleanup event listener on unmount', () => {
    // ARRANGE
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const onCmdK = vi.fn();

    const { unmount } = renderHook(() => useKeyboardShortcuts({ onCmdK }));

    // ACT
    unmount();

    // ASSERT
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
