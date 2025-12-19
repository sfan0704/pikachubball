import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Settings, ExternalLink, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const yahooCredentialsSchema = z.object({
  clientId: z.string().min(10, "Client ID must be at least 10 characters"),
  clientSecret: z.string().min(10, "Client Secret must be at least 10 characters"),
});

type YahooCredentialsFormData = z.infer<typeof yahooCredentialsSchema>;

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: yahooStatus, isLoading: isLoadingYahooStatus } = useQuery<{
    connected: boolean;
    hasValidToken: boolean;
    hasCredentials: boolean;
  }>({
    queryKey: ["/api/auth/yahoo/status"],
    enabled: open,
  });

  const { data: credentialsStatus } = useQuery<{
    hasCredentials: boolean;
    updatedAt: string | null;
  }>({
    queryKey: ["/api/settings/yahoo-credentials"],
    enabled: open,
  });

  // Fetch the actual redirect URI being used
  const { data: redirectUriData } = useQuery<{
    redirectUri: string;
  }>({
    queryKey: ["/api/auth/yahoo-redirect-uri"],
    enabled: open && !isLoadingYahooStatus,
    queryFn: async () => {
      // Fetch the auth URL to get the redirect URI (it's returned in the response)
      const response = await fetch("/api/auth/yahoo", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        return { redirectUri: data.redirectUri || `${window.location.origin}/api/auth/yahoo/callback` };
      }
      return { redirectUri: `${window.location.origin}/api/auth/yahoo/callback` };
    },
  });

  const yahooForm = useForm<YahooCredentialsFormData>({
    resolver: zodResolver(yahooCredentialsSchema),
    defaultValues: {
      clientId: "",
      clientSecret: "",
    },
  });

  const connectYahooMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/yahoo", {
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to initiate authentication");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Yahoo",
        variant: "destructive",
      });
    },
  });

  const disconnectYahooMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/auth/yahoo", "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Disconnected",
        description: "Yahoo Fantasy account disconnected successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/yahoo/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect",
        variant: "destructive",
      });
    },
  });

  const handleConnectYahoo = () => {
    connectYahooMutation.mutate();
  };

  const handleDisconnectYahoo = () => {
    disconnectYahooMutation.mutate();
  };

  const saveCredentialsMutation = useMutation({
    mutationFn: async (data: YahooCredentialsFormData) => {
      return await apiRequest("/api/settings/yahoo-credentials", "POST", data);
    },
    onSuccess: async (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/yahoo-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/yahoo/status"] });
      yahooForm.reset();
      
      if (response?.requiresReconnection) {
        toast({
          title: "Credentials Updated",
          description: "Your credentials have been updated. Please reconnect your Yahoo account.",
        });
        // Auto-initiate reconnection if user was previously connected
        setTimeout(async () => {
          try {
            const authResponse = await fetch("/api/auth/yahoo", {
              credentials: "include",
            });
            if (authResponse.ok) {
              const authData = await authResponse.json();
              if (authData.authUrl) {
                window.location.href = authData.authUrl;
              }
            }
          } catch (error) {
            // User can connect manually from Settings
          }
        }, 1000);
      } else {
        toast({
          title: "Credentials Saved",
          description: "Your Yahoo credentials have been saved successfully.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save credentials",
        variant: "destructive",
      });
    },
  });

  const deleteCredentialsMutation = useMutation({
    mutationFn: async () => {
      // Check if user is connected - must disconnect first
      if (yahooStatus?.connected) {
        throw new Error("Please disconnect your Yahoo account before removing credentials");
      }
      return await apiRequest("/api/settings/yahoo-credentials", "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Credentials Removed",
        description: "Your Yahoo credentials have been removed. You'll need to add them again to use the app.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/yahoo-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/yahoo/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete credentials",
        variant: "destructive",
      });
    },
  });

  const handleCredentialsSubmit = (data: YahooCredentialsFormData) => {
    saveCredentialsMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-settings">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your Yahoo Fantasy API connection and preferences.
          </DialogDescription>
        </DialogHeader>

        {/* Yahoo Credentials Section - Primary */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Yahoo OAuth Credentials</h3>
          
          {isLoadingYahooStatus ? (
            <div className="flex items-center justify-center py-4">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs space-y-2 mb-4">
                <p className="font-semibold text-xs">📋 Redirect URI (for Yahoo Developer Portal)</p>
                <div className="bg-background rounded p-2 font-mono text-xs break-all">
                  {redirectUriData?.redirectUri || 'Loading...'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy this URL and add it to your Yahoo app's "Redirect URI(s)" field in the Yahoo Developer Portal.
                  <br />
                  <strong className="text-amber-600 dark:text-amber-400">⚠️ This must match EXACTLY (including the full path)</strong>
                </p>
              </div>

              {credentialsStatus?.hasCredentials ? (
                <div className="rounded-md bg-muted p-4 space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">✓ Credentials Saved</p>
                    <p className="text-xs text-muted-foreground">
                      {credentialsStatus.updatedAt 
                        ? `Saved on ${new Date(credentialsStatus.updatedAt).toLocaleDateString()}`
                        : "Your Yahoo credentials are configured"}
                    </p>
                    {yahooStatus?.connected && (
                      <p className="text-xs text-muted-foreground mt-2">
                        ℹ️ Updating credentials will require reconnection to your Yahoo account.
                      </p>
                    )}
                  </div>
                  {!yahooStatus?.connected && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Credentials
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Credentials?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove your saved Yahoo credentials. You'll need to add them again to use the app.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteCredentialsMutation.mutate()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Yahoo OAuth credentials are required to use this app. Get them from the{" "}
                    <a
                      href="https://developer.yahoo.com/apps/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Yahoo Developer Portal
                    </a>
                    .
                  </p>
                  <Form {...yahooForm}>
                    <form onSubmit={yahooForm.handleSubmit(handleCredentialsSubmit)} className="space-y-3">
                      <FormField
                        control={yahooForm.control}
                        name="clientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Yahoo Client ID</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Enter your Yahoo Client ID"
                                className="h-8 text-xs"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={yahooForm.control}
                        name="clientSecret"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Yahoo Client Secret</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                placeholder="Enter your Yahoo Client Secret"
                                className="h-8 text-xs"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Your credentials are encrypted and stored securely.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        size="sm"
                        className="w-full"
                        disabled={saveCredentialsMutation.isPending}
                      >
                        {saveCredentialsMutation.isPending ? "Saving..." : "Save Credentials"}
                      </Button>
                    </form>
                  </Form>
                </div>
              )}
            </>
          )}
        </div>

        {/* Yahoo Connection Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Yahoo Fantasy Connection</h3>
          
          {yahooStatus?.connected ? (
            <div className="rounded-md bg-muted p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">✓ Connected</p>
                <p className="text-xs text-muted-foreground">
                  {yahooStatus.hasValidToken 
                    ? "Your Yahoo Fantasy account is connected and ready to use"
                    : "Your connection may need to be refreshed"}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Disconnect Yahoo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Yahoo Account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will disconnect your Yahoo Fantasy account. You can reconnect anytime.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnectYahoo}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {yahooStatus?.hasCredentials 
                  ? "Connect your Yahoo Fantasy account to access your leagues and get AI-powered insights."
                  : "Add your Yahoo credentials above first, then connect your account."}
              </p>
              <Button
                onClick={handleConnectYahoo}
                disabled={connectYahooMutation.isPending || !yahooStatus?.hasCredentials}
                className="w-full"
              >
                {connectYahooMutation.isPending ? (
                  "Connecting..."
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect to Yahoo
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
