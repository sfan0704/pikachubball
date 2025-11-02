import { useState, useEffect } from "react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import QuickActions from "@/components/QuickActions";
import PlayerStatCard from "@/components/PlayerStatCard";
import TeamRoster from "@/components/TeamRoster";
import ComparisonTable from "@/components/ComparisonTable";
import LoadingIndicator from "@/components/LoadingIndicator";
import ThemeToggle from "@/components/ThemeToggle";
import YahooConnect from "@/components/YahooConnect";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  timestamp: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi! I'm your Fantasy Basketball AI assistant. I can help you analyze your team, suggest start/sit decisions, find waiver wire pickups, and optimize your roster. What would you like to know?",
      timestamp: "2:30 PM"
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('yahoo_connected') === 'true') {
      toast({
        title: "Yahoo Fantasy Connected",
        description: "Successfully connected to your Yahoo Fantasy account.",
      });
      window.history.replaceState({}, '', '/');
    } else if (params.get('error')) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Yahoo Fantasy. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/');
    }
  }, [toast]);

  const mockRoster = [
    { name: "Nikola Jokic", position: "C", team: "DEN", status: "active" as const },
    { name: "Luka Doncic", position: "PG", team: "DAL", status: "active" as const },
    { name: "Joel Embiid", position: "C", team: "PHI", status: "injured" as const },
    { name: "Jayson Tatum", position: "SF", team: "BOS", status: "active" as const },
    { name: "Damian Lillard", position: "PG", team: "MIL", status: "active" as const },
    { name: "Anthony Edwards", position: "SG", team: "MIN", status: "active" as const },
  ];

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I've analyzed your request using multiple data sources. Based on current stats from BALLDONTLIE and insights from Reddit's r/fantasybaskeball, here's my recommendation...",
        sources: ["BALLDONTLIE", "Reddit", "YouTube"],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleQuickAction = (action: string) => {
    const actionMessages: { [key: string]: string } = {
      "start-sit": "Who should I start today?",
      "waiver": "What are the top waiver wire pickups this week?",
      "trades": "Suggest some trades to improve my team",
      "matchup": "Analyze my matchup this week"
    };
    
    if (actionMessages[action]) {
      handleSendMessage(actionMessages[action]);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {showSidebar && (
        <aside className="w-80 border-r border-border bg-sidebar p-4 overflow-y-auto">
          <div className="space-y-4">
            <YahooConnect />
            <TeamRoster players={mockRoster} />
            
            <div className="grid grid-cols-1 gap-4">
              <PlayerStatCard
                name="Nikola Jokic"
                position="C"
                team="DEN"
                stats={[
                  { label: "PPG", value: "26.4" },
                  { label: "RPG", value: "12.4" }
                ]}
                trend="up"
              />
            </div>

            <ComparisonTable
              title="League Leaders"
              columns={["PPG"]}
              data={[
                { player: "Embiid", stats: { PPG: "33.1" } },
                { player: "Doncic", stats: { PPG: "28.8" } },
              ]}
            />
          </div>
        </aside>
      )}

      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(!showSidebar)}
              data-testid="button-sidebar-toggle"
            >
              {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <h1 className="text-xl font-semibold" data-testid="heading-app-title">Fantasy Basketball AI</h1>
          </div>
          <ThemeToggle />
        </header>

        <QuickActions onActionClick={handleQuickAction} />

        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto p-6">
            {messages.map(msg => (
              <ChatMessage key={msg.id} {...msg} />
            ))}
            {isLoading && <LoadingIndicator message="Querying MCP servers..." />}
          </div>
        </ScrollArea>

        <ChatInput onSend={handleSendMessage} disabled={isLoading} />
      </main>
    </div>
  );
}