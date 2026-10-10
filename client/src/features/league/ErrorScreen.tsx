import { Redirect } from "wouter";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describeError } from "./error-screens";

interface ErrorScreenProps {
  error: unknown;
  onRetry: () => void;
  onPickLeague: () => void;
  /** Smaller, for an error above data that is still on screen. */
  inline?: boolean;
}

/** The one screen for any failed request: what happened, what to do, and the request id. */
export function ErrorScreen({ error, onRetry, onPickLeague, inline = false }: ErrorScreenProps) {
  const screen = describeError(error);
  if (screen.action === "sign-in") {
    return <Redirect to="/auth" />;
  }
  return (
    <Alert variant="destructive" role="alert" className={inline ? "mb-4" : "my-8"}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{screen.title}</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{screen.message}</p>
        {screen.requestId && (
          <p className="text-xs">
            Reference: <span className="font-mono">{screen.requestId}</span>
          </p>
        )}
        {screen.action === "retry" && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
        {screen.action === "pick-league" && (
          <Button variant="outline" size="sm" onClick={onPickLeague}>
            Choose a league
          </Button>
        )}
        {screen.action === "reconnect-yahoo" && (
          <Button asChild size="sm">
            <a href="/api/auth/yahoo">Sign in with Yahoo</a>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
