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
import { Settings, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const credentialsSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
});

type CredentialsFormData = z.infer<typeof credentialsSchema>;

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: credentialsStatus } = useQuery<{ hasCredentials: boolean; updatedAt: string | null }>({
    queryKey: ["/api/settings/yahoo-credentials"],
    enabled: open,
  });

  const form = useForm<CredentialsFormData>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      clientId: "",
      clientSecret: "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: CredentialsFormData) => {
      return await apiRequest("/api/settings/yahoo-credentials", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Yahoo credentials saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/yahoo-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/yahoo/status"] });
      form.reset();
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save credentials",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/settings/yahoo-credentials", "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Yahoo credentials deleted successfully",
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

  const handleSubmit = (data: CredentialsFormData) => {
    saveMutation.mutate(data);
  };

  const handleDelete = () => {
    deleteMutation.mutate();
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
          <DialogTitle>Yahoo API Settings</DialogTitle>
          <DialogDescription>
            Configure your Yahoo API credentials to connect to your Fantasy Basketball account.
          </DialogDescription>
        </DialogHeader>

        {credentialsStatus?.hasCredentials && (
          <div className="rounded-md bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Current Status</p>
            <div className="text-sm text-muted-foreground">
              <p>✓ Yahoo credentials configured</p>
              {credentialsStatus.updatedAt && (
                <p className="text-xs mt-1">
                  Last updated: {new Date(credentialsStatus.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full mt-2"
                  data-testid="button-delete-credentials"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Credentials
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete your Yahoo API credentials and disconnect your Yahoo Fantasy account. 
                    You'll need to re-enter your credentials to reconnect.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm space-y-2">
            <p className="font-semibold text-xs">📋 Your Redirect URI</p>
            <div className="bg-background rounded p-2 font-mono text-xs break-all">
              {window.location.origin}/api/auth/yahoo/callback
            </div>
            <p className="text-xs text-muted-foreground">
              Copy this URL for the "Redirect URI(s)" field in your Yahoo app
            </p>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm space-y-2">
            <p className="font-medium text-sm">Setup Guide:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
              <li>
                Go to{" "}
                <a 
                  href="https://developer.yahoo.com/apps/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Yahoo Developer Apps
                </a>
              </li>
              <li>Click "Create an App"</li>
              <li>Set <strong>Application Type</strong> to "Web Application"</li>
              <li>Paste the Redirect URI from above</li>
              <li>Check <strong>Fantasy Sports</strong> with Read/Write permission</li>
              <li>Copy your Client ID and Secret below</li>
            </ol>
          </div>

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
                        data-testid="input-client-id"
                      />
                    </FormControl>
                    <FormDescription>
                      Your Yahoo app's Client ID (also called Consumer Key)
                    </FormDescription>
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
                        data-testid="input-client-secret"
                      />
                    </FormControl>
                    <FormDescription>
                      Your Yahoo app's Client Secret (also called Consumer Secret)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={saveMutation.isPending}
                data-testid="button-save-credentials"
              >
                {saveMutation.isPending ? "Saving..." : "Save Credentials"}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
