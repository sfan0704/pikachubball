import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeError } from "@/features/league/error-screens";

/** What removing something does at Yahoo, as reported by the API. */
export interface RemovalResult {
  revokedAtYahoo: boolean;
}

export interface AccountActions {
  signOut(): Promise<unknown>;
  disconnectYahoo(): Promise<RemovalResult>;
  deleteAccount(): Promise<RemovalResult>;
}

type Pending = "disconnect" | "delete" | null;

const CONFIRMATIONS = {
  disconnect: {
    title: "Disconnect Yahoo?",
    body: "This revokes this app's access at Yahoo and deletes your stored Yahoo connection and your league list from Pikachu Basketball. Your account stays, and you can connect Yahoo again by signing in.",
    confirm: "Disconnect Yahoo",
  },
  delete: {
    title: "Delete your account?",
    body: "This revokes this app's access at Yahoo and permanently deletes your account and everything stored for it: your Yahoo connection, leagues and saved choices. It can't be undone.",
    confirm: "Delete my account",
  },
} as const;

function removalMessage(kind: "disconnect" | "delete", result: RemovalResult): string {
  const done = kind === "disconnect" ? "Yahoo disconnected." : "Account deleted.";
  return result.revokedAtYahoo
    ? `${done} Access was revoked at Yahoo.`
    : `${done} Yahoo did not confirm the revocation; to be sure, remove Pikachu Basketball from your Yahoo account's connected apps.`;
}

function ConfirmationPanel({
  kind,
  busy,
  onConfirm,
  onCancel,
}: {
  kind: "disconnect" | "delete";
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmation = CONFIRMATIONS[kind];
  return (
    <Alert role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-body">
      <AlertTitle id="confirm-title">{confirmation.title}</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p id="confirm-body">{confirmation.body}</p>
        <div className="flex gap-2">
          <Button
            variant={kind === "delete" ? "destructive" : "default"}
            size="sm"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmation.confirm}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/** Sign out, disconnect Yahoo and delete the account; the last two ask first and say what they remove. */
export function AccountControls({ actions }: { actions: AccountActions }) {
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "disconnect" | "delete") => {
    setBusy(true);
    setError(null);
    try {
      const result =
        kind === "disconnect" ? await actions.disconnectYahoo() : await actions.deleteAccount();
      setMessage(removalMessage(kind, result));
      setPending(null);
    } catch (failure) {
      setError(describeError(failure).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="card-account">
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Signing out keeps your data; the other two remove it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void actions.signOut()} disabled={busy}>
            Sign out
          </Button>
          <Button variant="outline" onClick={() => setPending("disconnect")} disabled={busy}>
            Disconnect Yahoo
          </Button>
          <Button variant="destructive" onClick={() => setPending("delete")} disabled={busy}>
            Delete account
          </Button>
        </div>
        {pending && (
          <ConfirmationPanel
            kind={pending}
            busy={busy}
            onConfirm={() => void run(pending)}
            onCancel={() => setPending(null)}
          />
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
