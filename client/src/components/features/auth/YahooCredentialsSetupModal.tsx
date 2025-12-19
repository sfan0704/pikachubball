import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Copy, Check } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

const yahooCredentialsSchema = z.object({
  clientId: z.string().min(10, "Client ID must be at least 10 characters"),
  clientSecret: z.string().min(10, "Client Secret must be at least 10 characters"),
});

type YahooCredentialsFormData = z.infer<typeof yahooCredentialsSchema>;

interface YahooCredentialsSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Blocking modal that appears when user needs to set up Yahoo OAuth credentials
 * Cannot be dismissed until credentials are saved
 */
export default function YahooCredentialsSetupModal({ open, onOpenChange }: YahooCredentialsSetupModalProps) {
  const { toast } = useToast();
  const [redirectUri, setRedirectUri] = useState<string>("");
  const [copied, setCopied] = useState(false);
  
  // Check if user dismissed this modal for this session
  const SESSION_DISMISS_KEY = 'yahoo_credentials_modal_dismissed';
  const isDismissedForSession = typeof window !== 'undefined' && sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true';

  const form = useForm<YahooCredentialsFormData>({
    resolver: zodResolver(yahooCredentialsSchema),
    defaultValues: {
      clientId: "",
      clientSecret: "",
    },
  });

  // Fetch redirect URI
  useEffect(() => {
    if (open) {
      // Get redirect URI from the auth endpoint
      fetch("/api/auth/yahoo", {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.redirectUri) {
            setRedirectUri(data.redirectUri);
          } else {
            // Fallback
            setRedirectUri(`${window.location.origin}/api/auth/yahoo/callback`);
          }
        })
        .catch(() => {
          // Fallback
          setRedirectUri(`${window.location.origin}/api/auth/yahoo/callback`);
        });
    }
  }, [open]);

  const saveCredentialsMutation = useMutation({
    mutationFn: async (data: YahooCredentialsFormData) => {
      return await apiRequest("/api/settings/yahoo-credentials", "POST", data);
    },
    onSuccess: async () => {
      toast({
        title: "Credentials Saved",
        description: "Your Yahoo credentials have been saved. Redirecting to connect your account...",
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/settings/yahoo-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/yahoo/status"] });
      
      // Auto-initiate OAuth after a brief delay
      setTimeout(async () => {
        try {
          const response = await fetch("/api/auth/yahoo", {
            credentials: "include",
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.authUrl) {
              window.location.href = data.authUrl;
            }
          } else {
            const error = await response.json();
            toast({
              title: "Connection Failed",
              description: error.error || "Failed to initiate authentication. Please try connecting from Settings.",
              variant: "destructive",
            });
            onOpenChange(false);
          }
        } catch (error: any) {
          toast({
            title: "Connection Failed",
            description: error.message || "Failed to initiate authentication. Please try connecting from Settings.",
            variant: "destructive",
          });
          onOpenChange(false);
        }
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save credentials",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: YahooCredentialsFormData) => {
    saveCredentialsMutation.mutate(data);
  };

  const handleCopyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Redirect URI copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSkipForNow = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    }
    onOpenChange(false);
  };

  // Don't show if dismissed for session
  const shouldShow = open && !isDismissedForSession;

  return (
    <Dialog open={shouldShow} onOpenChange={(open) => {
      if (!open) {
        handleSkipForNow();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Up Yahoo OAuth Credentials</DialogTitle>
          <DialogDescription>
            To use this app, you need to provide your own Yahoo OAuth credentials. Don't worry, it only takes a minute!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Instructions */}
          <div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-3">
            <h3 className="font-semibold text-sm">Step 1: Get Your Credentials</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Go to the <a href="https://developer.yahoo.com/apps/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                Yahoo Developer Portal <ExternalLink className="h-3 w-3" />
              </a></li>
              <li>Create a new app or use an existing one</li>
              <li>Copy your <strong>Client ID</strong> and <strong>Client Secret</strong></li>
              <li>Add the redirect URI below to your app's "Redirect URI(s)" field</li>
            </ol>
          </div>

          {/* Redirect URI */}
          <div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Redirect URI (add this to your Yahoo app):</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyRedirectUri}
                className="h-8"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="bg-background rounded p-2 font-mono text-xs break-all border">
              {redirectUri || "Loading..."}
            </div>
            <p className="text-xs text-muted-foreground">
              <strong className="text-amber-600 dark:text-amber-400">⚠️ Important:</strong> This must match EXACTLY in your Yahoo Developer Portal (including the full path)
            </p>
          </div>

          {/* Credentials Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yahoo Client ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your Yahoo Client ID"
                        disabled={saveCredentialsMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yahoo Client Secret</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter your Yahoo Client Secret"
                        disabled={saveCredentialsMutation.isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      Your credentials are encrypted and stored securely. Only you can access them.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={saveCredentialsMutation.isPending}
                >
                  {saveCredentialsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving & Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Save Credentials & Connect
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSkipForNow}
                  className="w-full"
                >
                  Skip for now
                </Button>
              </div>
            </form>
          </Form>

          <p className="text-xs text-center text-muted-foreground">
            After saving, you'll be redirected to Yahoo to authorize access to your Fantasy account.
            <br />
            <strong className="text-amber-600 dark:text-amber-400">Note:</strong> Credentials are required to use the app features.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
