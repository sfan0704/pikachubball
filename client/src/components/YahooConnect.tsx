import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface YahooStatus {
  connected: boolean;
  hasValidToken: boolean;
}

export default function YahooConnect() {
  const { toast } = useToast();
  
  const { data: status, isLoading } = useQuery<YahooStatus>({
    queryKey: ["/api/auth/yahoo/status"],
    refetchInterval: 30000, // Check every 30 seconds
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/yahoo");
      const data = await response.json();
      window.location.href = data.authUrl;
    },
    onError: () => {
      toast({
        title: "Connection Error",
        description: "Failed to initiate Yahoo connection. Please try again.",
        variant: "destructive",
      });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/yahoo", {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/yahoo/status"] });
      toast({
        title: "Disconnected",
        description: "Yahoo Fantasy account has been disconnected.",
      });
    },
    onError: () => {
      toast({
        title: "Disconnection Error",
        description: "Failed to disconnect Yahoo account. Please try again.",
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Checking connection...</span>
        </div>
      </Card>
    );
  }

  const isConnected = status?.connected && status?.hasValidToken;
  const needsReauth = status?.connected && !status?.hasValidToken;

  return (
    <Card className="p-4" data-testid="card-yahoo-connect">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          {isConnected ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : needsReauth ? (
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm">Yahoo Fantasy</p>
            <p className="text-xs text-muted-foreground truncate">
              {isConnected ? "Connected" : needsReauth ? "Reconnect needed" : "Not connected"}
            </p>
          </div>
        </div>
        
        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            data-testid="button-disconnect"
          >
            {disconnectMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Disconnect"
            )}
          </Button>
        ) : (
          <Button
            variant={needsReauth ? "destructive" : "default"}
            size="sm"
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            data-testid="button-connect"
          >
            {connectMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : needsReauth ? (
              "Reconnect"
            ) : (
              "Connect"
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}