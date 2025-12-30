import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink } from "lucide-react";

interface YahooConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal that appears after login to connect Yahoo Fantasy account
 * This is the primary way users connect - not hidden in settings
 */
export default function YahooConnectionModal({ open, onOpenChange }: YahooConnectionModalProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [authUrl, _setAuthUrl] = useState<string | null>(null);

  // Check if user dismissed this modal for this session
  const SESSION_DISMISS_KEY = 'yahoo_connection_modal_dismissed';
  const isDismissedForSession = typeof window !== 'undefined' && sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true';

  // Check Yahoo connection status
  const { data: status, isLoading: isLoadingStatus } = useQuery<{
    connected: boolean;
    hasValidToken: boolean;
    hasCredentials: boolean;
  }>({
    queryKey: ["/api/auth/yahoo/status"],
    enabled: open,
  });

  // Don't show if dismissed for this session
  const shouldShow = open && !isDismissedForSession;

  const handleConnect = async () => {
    // If we already have an auth URL, use it immediately
    if (authUrl) {
      window.location.href = authUrl;
      return;
    }

    // Get OAuth URL
    setIsConnecting(true);
    try {
      const response = await fetch("/api/auth/yahoo", {
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        let errorMessage = error.error || error.message || "Failed to initiate authentication";
        
        // Check if credentials are missing
        if (error.error?.includes("credentials") || error.message?.includes("credentials")) {
          errorMessage = "Yahoo credentials are required. Please add them in Settings first.";
        }
        
        toast({
          title: "Connection Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      const data = await response.json();
      
      if (data.authUrl) {
        // Log redirect URI for debugging
        if (data.redirectUri) {
          console.log("Redirect URI:", data.redirectUri);
          console.log("Make sure this matches exactly what's configured in your Yahoo Developer Portal");
        }
        // Redirect to Yahoo OAuth
        window.location.href = data.authUrl;
      } else {
        toast({
          title: "Connection Failed",
          description: "No authorization URL received from server",
          variant: "destructive",
        });
        setIsConnecting(false);
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to get authorization URL",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleDismissForSession = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    }
    onOpenChange(false);
  };

  // Don't show modal if already connected or dismissed for session
  if (status?.connected || !shouldShow) {
    return null;
  }

  return (
    <Dialog open={shouldShow} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Your Yahoo Fantasy Account</DialogTitle>
          <DialogDescription>
            Connect your Yahoo Fantasy account to access your leagues, teams, and get AI-powered insights.
          </DialogDescription>
        </DialogHeader>

        {isLoadingStatus ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !status?.hasCredentials ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Yahoo credentials are required before connecting. Please add your Client ID and Client Secret in Settings first.
            </p>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Go to Settings
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              You'll be redirected to Yahoo to authorize access to your Fantasy account.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full"
                size="lg"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Connect to Yahoo
                  </>
                )}
              </Button>
              <Button
                onClick={handleDismissForSession}
                variant="ghost"
                size="sm"
                className="w-full"
              >
                Remind me later
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              You'll be redirected to Yahoo for authorization. You can connect anytime from Settings.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

