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
import SettingsDialog from "@/components/SettingsDialog";
import { useAuth } from "@/lib/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Menu, X, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

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
  const [selectedTeamKey, setSelectedTeamKey] = useState<string | null>(null);
  const { toast } = useToast();
  const { logout, user } = useAuth();

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

  // Fetch user's leagues
  const { data: leaguesData, isLoading: isLoadingLeagues } = useQuery<{
    leagues: Array<{
      leagueKey: string;
      leagueName: string;
      teamKey: string;
      teamName: string;
    }>;
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
    roster: Array<{
      name: string;
      position: string;
      team: string;
      status: "active" | "injured" | "out";
      playerKey?: string;
    }>;
  }>({
    queryKey: ["/api/yahoo/roster-by-team", selectedTeamKey],
    enabled: !!selectedTeamKey,
    retry: false,
  });

  const roster = rosterData?.roster || [];
  const selectedLeague = leaguesData?.leagues?.find(l => l.teamKey === selectedTeamKey);

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
          <div className="flex items-center gap-2">
            {user && (
              <span className="text-sm text-muted-foreground mr-2" data-testid="text-username">
                {user.username}
              </span>
            )}
            <SettingsDialog />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await logout();
                toast({
                  title: "Logged out",
                  description: "You have been logged out successfully",
                });
              }}
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
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