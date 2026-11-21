import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { removalFromSearch } from "@/features/account/removal";

/** Sign-in with Yahoo; after a disconnect or account deletion it also says what was removed. */
export default function AuthPage() {
  const removal = removalFromSearch(window.location.search);
  const handleYahooLogin = () => {
    window.location.assign("/api/auth/yahoo");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-2xl">🏀</span>
          </div>
          <CardTitle className="text-2xl font-bold">Yahoo Fantasy Basketball</CardTitle>
          <CardDescription>
            Sign in with Yahoo to access your fantasy basketball leagues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {removal && (
            <p role="status" className="text-sm" data-testid="text-removal">
              {removal}
            </p>
          )}
          {/* Primary: Yahoo Login */}
          <Button
            onClick={handleYahooLogin}
            className="w-full h-12 font-semibold"
            data-testid="button-yahoo-login"
          >
            Continue with Yahoo
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            The app requests read-only access to your Yahoo Fantasy Sports data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
