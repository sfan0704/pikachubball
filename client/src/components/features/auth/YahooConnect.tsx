import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CheckCircle2, XCircle, Loader2, Settings } from "lucide-react";

export default function YahooConnect() {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: status, isLoading } = useQuery<{
    hasCredentials: boolean;
    connected: boolean;
    hasValidToken: boolean;
  }>({
    queryKey: ["/api/auth/yahoo/status"],
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/auth/yahoo", "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Yahoo Fantasy Disconnected",
        description: "Your Yahoo Fantasy account has been disconnected.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/yahoo/status"] });
    },
  });

  const handleConnect = async () => {
    if (!status?.hasCredentials) {
      toast({
        title: "Credentials Required",
        description: "Please add your Yahoo API credentials in Settings first.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      const response = await fetch("/api/auth/yahoo", {
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to initiate authentication");
      }

      const data = await response.json();
      
      if (data.authUrl) {
        console.log("Redirecting to Yahoo OAuth URL:", data.authUrl);
        // Try opening in a new window first as a fallback
        const newWindow = window.open(data.authUrl, '_blank');
        if (!newWindow) {
          // If popup blocked, try direct navigation
          console.log("Popup blocked, using direct navigation");
          window.location.href = data.authUrl;
        }
      }
    } catch (error: any) {
      console.error("Yahoo connect error:", error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to initiate Yahoo authentication",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Hide the component when already connected
  if (status?.connected) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Yahoo Fantasy</span>
          <Badge
            variant={status?.connected ? "default" : "secondary"}
            data-testid="badge-connection-status"
          >
            {status?.connected ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!status?.hasCredentials ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Add your Yahoo API credentials in Settings to connect your account.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-setup-credentials"
              disabled
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure in Settings
            </Button>
          </div>
        ) : status?.connected ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your Yahoo Fantasy account is connected and ready to use.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}
              className="w-full"
              data-testid="button-disconnect-yahoo"
            >
              {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Connect your Yahoo Fantasy account to get personalized insights and team data.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              size="sm"
              className="w-full"
              data-testid="button-connect-yahoo"
            >
              {isConnecting ? "Connecting..." : "Connect Yahoo"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
