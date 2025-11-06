import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-background p-3 md:p-4 w-full">
      <div className="max-w-4xl mx-auto flex gap-2 items-end w-full">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your team, players, matchups..."
          className="flex-1 min-w-0 min-h-[48px] md:min-h-[56px] max-h-32 resize-none rounded-xl text-sm md:text-base"
          disabled={disabled}
          data-testid="input-chat"
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          size="icon"
          className="h-12 w-12 md:h-14 md:w-14 flex-shrink-0"
          data-testid="button-send"
        >
          <Send className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
      </div>
    </div>
  );
}