import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  timestamp?: string;
}

export default function ChatMessage({ role, content, sources, timestamp }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-2 md:gap-4 ${isUser ? "justify-end" : "justify-start"} mb-4 md:mb-6`}>
      {!isUser && (
        <Avatar className="w-7 h-7 md:w-8 md:h-8 flex-shrink-0" data-testid="avatar-assistant">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="w-3 h-3 md:w-4 md:h-4" />
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[85%] md:max-w-2xl`}>
        <div
          className={`px-3 py-2 md:px-4 md:py-3 ${
            isUser
              ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
              : "bg-card border border-card-border rounded-2xl rounded-tl-sm"
          }`}
          data-testid={`message-${role}`}
        >
          <p className="text-sm md:text-base whitespace-pre-wrap break-words">{content}</p>
        </div>
        
        {sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2" data-testid="message-sources">
            {sources.map((source, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="text-xs rounded-full px-2 md:px-3 py-0.5 md:py-1"
                data-testid={`badge-source-${idx}`}
              >
                {source}
              </Badge>
            ))}
          </div>
        )}
        
        {timestamp && (
          <span className="text-xs text-muted-foreground mt-1" data-testid="message-timestamp">
            {timestamp}
          </span>
        )}
      </div>

      {isUser && (
        <Avatar className="w-7 h-7 md:w-8 md:h-8 flex-shrink-0" data-testid="avatar-user">
          <AvatarFallback className="bg-accent text-accent-foreground">
            <User className="w-3 h-3 md:w-4 md:h-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}