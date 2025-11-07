import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface FloatingChatButtonProps {
  onClick: () => void;
  unreadCount?: number;
}

export default function FloatingChatButton({ onClick, unreadCount }: FloatingChatButtonProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const button = (
    <Button
      onClick={onClick}
      size="icon"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-[9999] floating-chat-button"
      data-testid="button-floating-chat"
    >
      <MessageSquare className="h-6 w-6" />
      {unreadCount && unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );

  if (!mounted) return null;
  
  return createPortal(button, document.body);
}
