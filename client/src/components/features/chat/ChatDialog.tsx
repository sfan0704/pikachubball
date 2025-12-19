import { useState, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import QuickActions from "./QuickActions";
import TeamRoster from "../league/TeamRoster";
import LoadingIndicator from "@/components/common/LoadingIndicator";
import YahooConnect from "@/components/features/auth/YahooConnect";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useFirstLeague } from "@/hooks/useFirstLeague";
import { RosterSkeleton } from "@/components/common/RosterSkeleton";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { Menu } from "lucide-react";
import { useChat } from "@/lib/chatContext";
import type { Player } from "@shared/schema";

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
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const { toast } = useToast();
  const { selectedTeamKey: contextTeamKey, setSelectedTeamKey } = useChat();
  const [localSelectedTeamKey, setLocalSelectedTeamKey] = useState<string | null>(null);

  // Use shared hook for league fetching
  const { leagues, selectedLeague, isLoadingLeagues } = useFirstLeague();

  // Use team key from context (synced from RankingsPage) or local state
  const selectedTeamKey = contextTeamKey || localSelectedTeamKey;

  // Sync with context when it changes, or fallback to selectedLeague
  useEffect(() => {
    if (contextTeamKey) {
      setLocalSelectedTeamKey(contextTeamKey);
    } else if (selectedLeague && !localSelectedTeamKey) {
      setLocalSelectedTeamKey(selectedLeague.teamKey);
      setSelectedTeamKey(selectedLeague.teamKey);
    }
  }, [contextTeamKey, selectedLeague, localSelectedTeamKey, setSelectedTeamKey]);

  // Update context when local selection changes
  const handleTeamChange = (teamKey: string | null) => {
    setLocalSelectedTeamKey(teamKey);
    setSelectedTeamKey(teamKey);
  };

  // Fetch roster for selected team
  const { data: rosterData, isLoading: isLoadingRoster, error: rosterError } = useQuery<{
    roster: Player[];
  }>({
    queryKey: ["/api/yahoo/roster-by-team", selectedTeamKey],
    enabled: !!selectedTeamKey,
    retry: false,
  });

  const roster = rosterData?.roster || [];

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Find the league for the selected team
      const teamLeague = leagues.find(l => l.teamKey === selectedTeamKey);
      
      // Prepare conversation history (last 10 messages for context)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          teamKey: selectedTeamKey,
          leagueKey: teamLeague?.leagueKey,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle Yahoo connection errors
        if (errorData.requiresYahooConnection) {
          toast({
            title: "Yahoo Fantasy Not Connected",
            description: errorData.message || "Please connect your Yahoo Fantasy account first.",
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(errorData.message || "Failed to get response from AI");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
        <SheetHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <SheetTitle data-testid="heading-chat-title">Fantasy Basketball AI</SheetTitle>
          {/* Mobile sidebar toggle */}
          <Drawer open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Team & Roster</DrawerTitle>
              </DrawerHeader>
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <YahooConnect />
                
                {/* Team Selector */}
                {isLoadingLeagues ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : leagues && leagues.length > 0 ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Select Team
                    </label>
                    <Select 
                      value={selectedTeamKey || undefined} 
                      onValueChange={handleTeamChange}
                      data-testid="select-team-mobile"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a team..." />
                      </SelectTrigger>
                      <SelectContent>
                        {leagues.map((league) => (
                          <SelectItem 
                            key={league.teamKey} 
                            value={league.teamKey}
                            data-testid={`select-item-mobile-${league.teamKey}`}
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
                  <RosterSkeleton />
                ) : roster.length > 0 ? (
                  <TeamRoster players={roster} />
                ) : selectedTeamKey ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No roster data available
                  </div>
                ) : null}
              </div>
            </DrawerContent>
          </Drawer>
        </SheetHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Sidebar */}
          <aside className="w-64 border-r border-border bg-sidebar p-4 overflow-y-auto hidden md:block">
            <div className="space-y-4">
              <YahooConnect />
              
              {/* Team Selector */}
              {isLoadingLeagues ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : leagues && leagues.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-sidebar-foreground">
                    Select Team
                  </label>
                  <Select 
                    value={selectedTeamKey || undefined} 
                    onValueChange={handleTeamChange}
                    data-testid="select-team"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a team..." />
                    </SelectTrigger>
                    <SelectContent>
                      {leagues.map((league) => (
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
                <RosterSkeleton />
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
            {/* Error Banner */}
            {rosterError && selectedTeamKey && (
              <div className="p-4 border-b border-border">
                <ErrorBanner
                  title="Failed to Load Roster"
                  message={rosterError instanceof Error ? rosterError.message : "Unable to load roster data. Please try again."}
                  onRetry={() => queryClient.invalidateQueries({ queryKey: ["/api/yahoo/roster-by-team", selectedTeamKey] })}
                />
              </div>
            )}
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
