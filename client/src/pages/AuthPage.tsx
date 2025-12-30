import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const authSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type AuthFormData = z.infer<typeof authSchema>;

export default function AuthPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);

  const loginForm = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleYahooLogin = () => {
    // Redirect to Yahoo OAuth endpoint
    window.location.href = "/api/auth/yahoo";
  };

  const handleAdminLogin = async (data: AuthFormData) => {
    try {
      await login(data.username, data.password);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to log in",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-2xl">🏀</span>
          </div>
          <CardTitle className="text-2xl font-bold">
            Yahoo Fantasy Basketball
          </CardTitle>
          <CardDescription>
            Sign in with your Yahoo account to access your fantasy leagues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary: Yahoo Login */}
          <Button
            onClick={handleYahooLogin}
            className="w-full h-12 font-semibold"
            data-testid="button-yahoo-login"
          >
            <svg 
              className="w-5 h-5 mr-2" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
            Continue with Yahoo
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Secondary: Admin Login (Collapsible) */}
          <Collapsible open={adminLoginOpen} onOpenChange={setAdminLoginOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                data-testid="button-admin-toggle"
              >
                Admin Login
                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${adminLoginOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleAdminLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter admin username"
                            autoComplete="username"
                            data-testid="input-username-admin"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter password"
                            autoComplete="current-password"
                            data-testid="input-password-admin"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={loginForm.formState.isSubmitting}
                    data-testid="button-admin-login"
                  >
                    {loginForm.formState.isSubmitting ? "Logging in..." : "Log In as Admin"}
                  </Button>
                </form>
              </Form>
            </CollapsibleContent>
          </Collapsible>

          <p className="text-center text-xs text-muted-foreground">
            By signing in, you agree to allow this app to access your Yahoo Fantasy Sports data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
