import { useEffect } from "react";

interface KeyboardShortcuts {
  onCmdK?: () => void;
  onEscape?: () => void;
  onCmdSlash?: () => void;
}

export function useKeyboardShortcuts({ onCmdK, onEscape, onCmdSlash }: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K - Open chat
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        onCmdK?.();
      }
      
      // Escape - Close modals/dialogs
      if (event.key === 'Escape') {
        onEscape?.();
      }
      
      // Cmd/Ctrl + / - Show shortcuts help (future feature)
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        onCmdSlash?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCmdK, onEscape, onCmdSlash]);
}

