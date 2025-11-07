import { useState, useEffect } from "react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import QuickActions from "@/components/QuickActions";
import TeamRoster from "@/components/TeamRoster";
import LoadingIndicator from "@/components/LoadingIndicator";
import YahooConnect from "@/components/YahooConnect";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { League, Player } from "@shared/schema";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  timestamp: string;
}

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChatDialog({ open, onOpenChange }: ChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi! I'm your Fantasy Basketball AI assistant. I can help you analyze your team, suggest start/sit decisions, find waiver wire pickups, and optimize your roster. What would you like to know?",
      timestamp: "2:30 PM"
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTeamKey, setSelectedTeamKey] = useState<string | null>(null);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('yahoo_connected') === 'true') {
      toast({
        title: "Yahoo Fantasy Connected",
        description: "Successfully connected to your Yahoo Fantasy account.",
      });
      setLocation('/');
    } else if (params.get('error')) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Yahoo Fantasy. Please try again.",
        variant: "destructive",
      });
      setLocation('/');
    }
  }, [toast, setLocation]);

  // Fetch user's leagues
  const { data: leaguesData, isLoading: isLoadingLeagues } = useQuery<{
    leagues: League[];
  }>({
    queryKey: ["/api/yahoo/leagues"],
    retry: false,
  });

  // Auto-select first team when leagues load
  useEffect(() => {
    if (leaguesData?.leagues && leaguesData.leagues.length > 0 && !selectedTeamKey) {
      setSelectedTeamKey(leaguesData.leagues[0].teamKey);
    }
  }, [leaguesData, selectedTeamKey]);

  // Fetch roster for selected team
  const { data: rosterData, isLoading: isLoadingRoster } = useQuery<{
    roster: Player[];
  }>({
    queryKey: ["/api/yahoo/roster-by-team", selectedTeamKey],
    enabled: !!selectedTeamKey,
    retry: false,
  });

  const roster = rosterData?.roster || [];

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle data-testid="heading-chat-title">Fantasy Basketball AI</SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 border-r border-border bg-sidebar p-4 overflow-y-auto hidden md:block">
            <div className="space-y-4">
              <YahooConnect />
              
              {/* Team Selector */}
              {isLoadingLeagues ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading leagues...
                </div>
              ) : leaguesData && leaguesData.leagues.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-sidebar-foreground">
                    Select Team
                  </label>
                  <Select 
                    value={selectedTeamKey || undefined} 
                    onValueChange={setSelectedTeamKey}
                    data-testid="select-team"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a team..." />
                    </SelectTrigger>
                    <SelectContent>
                      {leaguesData.leagues.map((league) => (
                        <SelectItem 
                          key={league.teamKey} 
                          value={league.teamKey}
                          data-testid={`select-item-${league.teamKey}`}
                        >
                          {league.teamName} ({league.leagueName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              
              {/* Team Roster */}
              {isLoadingRoster ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading roster...
                </div>
              ) : roster.length > 0 ? (
                <TeamRoster players={roster} />
              ) : selectedTeamKey ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No roster data available
                </div>
              ) : null}
            </div>
          </aside>

          {/* Chat Content */}
          <div className="flex-1 flex flex-col min-w-0">
            <QuickActions onActionClick={handleQuickAction} />

            <ScrollArea className="flex-1">
              <div className="max-w-4xl mx-auto p-4">
                {messages.map(msg => (
                  <ChatMessage key={msg.id} {...msg} />
                ))}
                {isLoading && <LoadingIndicator message="Querying MCP servers..." />}
              </div>
            </ScrollArea>

            <div className="border-t border-border">
              <ChatInput onSend={handleSendMessage} disabled={isLoading} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
